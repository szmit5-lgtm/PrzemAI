"use strict";

const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const { randomBytes, randomUUID, createHash } = require("node:crypto");
const { once } = require("node:events");
const { mkdtemp, readFile, rm } = require("node:fs/promises");
const { createServer } = require("node:http");
const { tmpdir } = require("node:os");
const path = require("node:path");
const { setTimeout: delay } = require("node:timers/promises");

const repo = path.resolve(__dirname, "..");
const api = "http://127.0.0.1:3031";
const web = "http://127.0.0.1:3034";
const jwtSecret = randomBytes(32).toString("hex");
const password = randomBytes(24).toString("hex");
const requests = [];
const children = new Set();
let backend;

function start(command, args, cwd, variables) {
  const child = spawn(command, args, { cwd, env: {
    PATH: process.env.PATH, HOME: cwd, NODE_ENV: variables.NODE_ENV || "test", ...variables
  }, stdio: ["ignore", "inherit", "inherit"] });
  children.add(child);
  child.once("exit", () => children.delete(child));
  return child;
}

async function stop(child) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  const exited = once(child, "exit");
  child.kill();
  const signal = AbortSignal.timeout(5000);
  try { await Promise.race([exited, delay(5000, null, { signal })]); }
  catch (error) { if (error.name !== "AbortError") throw error; }
  if (child.exitCode === null && child.signalCode === null) {
    child.kill("SIGKILL");
    await exited;
  }
}

async function ready(url) {
  for (let attempt = 0; attempt < 120; attempt++) {
    try { if ((await fetch(url, { signal: AbortSignal.timeout(1000) })).ok) return; } catch {}
    await delay(250);
  }
  throw new Error("Local server unavailable: " + url);
}

function openAIMock() {
  return createServer(async (req, res) => {
    if (req.method !== "POST" || req.url !== "/v1/responses") return res.writeHead(404).end();
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const request = JSON.parse(Buffer.concat(chunks).toString());
    let records;
    try { ({ records } = JSON.parse(request.input[1].content[0].text)); } catch {}
    if (records) requests.push(request);
    const answer = Object.values(records || {}).filter(Array.isArray).flat()
      .map(row => row.invoice || row.title || row.name).filter(Boolean).join(", ");
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ object: "response", output: [
      { type: "message", content: [{ type: "output_text", text: "Źródła mocka: " + answer }] }
    ] }));
  });
}

async function seed(db) {
  const { hashPassword } = require("../lib/hash");
  const hashedPassword = await hashPassword(password);
  const run = randomBytes(5).toString("hex");
  const users = {};
  for (const name of ["owner", "member", "budget"]) {
    users[name] = await db.user.create({ data: {
      email: name + "-" + run + "@example.test", password: hashedPassword,
      agents: { create: [
        { key: "financial", name: "Financial", type: "FINANCIAL" },
        { key: "document", name: "Document", type: "DOCUMENT" },
        { key: "investment", name: "Investment", type: "INVESTMENT" }
      ] }
    } });
  }
  const companies = {};
  for (const [name, nip] of [["Dekonica", "1111111111"], ["Deherus", "2222222222"]]) {
    const company = await db.organization.create({ data: {
      name, slug: name.toLowerCase() + "-" + run,
      memberships: { create: [
        { userId: users.owner.id, role: "OWNER" },
        { userId: users.budget.id, role: "ADMIN", financeAccess: true },
        ...(name === "Dekonica" ? [{ userId: users.member.id, role: "MEMBER" }] : [])
      ] },
      financeLink: { create: { ownerUserId: users.owner.id, nip } }
    } });
    const bytes = Buffer.from("Treść zapisana " + name + "\nOPENAI_API_KEY=sk-syntheticE2E123");
    await db.organizationDocument.create({ data: {
      organizationId: company.id, name: "Dokument-" + name, content: bytes, contentType: "text/plain",
      size: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex")
    } });
    await db.financialDocument.create({ data: {
      userId: users.owner.id, source: "KSEF", invoiceNumber: "Faktura-" + name,
      buyerNip: nip, grossAmount: 123
    } });
    companies[name] = { ...company, investment: await db.organizationInvestment.create({ data: {
      organizationId: company.id, name: "Przypisana-" + name,
      assignedUserIds: name === "Dekonica" ? [users.member.id] : []
    } }) };
    await db.organizationInvestment.create({ data: {
      organizationId: company.id, name: "Nieprzypisana-" + name
    } });
  }
  return { users, companies };
}

async function json(url, { token, body } = {}) {
  const response = await fetch(api + url, {
    headers: { ...(token && { Authorization: "Bearer " + token }), ...(body && { "Content-Type": "application/json" }) },
    ...(body && { method: "POST", body: JSON.stringify(body) })
  });
  return { status: response.status, data: await response.json() };
}

async function tokenFor(user) {
  const response = await json("/api/auth/login", { body: { email: user.email, password } });
  assert.equal(response.status, 200);
  assert.ok(response.data.token);
  return response.data.token;
}

async function browserFlow(browser, owner, companies) {
  const context = await browser.newContext({ viewport: { width: 1360, height: 920 } });
  const page = await context.newPage();
  await page.goto(web + "/login");
  await page.getByLabel("E-mail").fill(owner.email);
  await page.getByLabel("Hasło", { exact: true }).fill(password);
  const [loginResponse] = await Promise.all([
    page.waitForResponse(response => response.url() === web + "/api/auth/login" && response.request().method() === "POST"),
    page.getByRole("button", { name: "Zaloguj się" }).click()
  ]);
  assert.equal(loginResponse.status(), 200);
  await page.waitForURL(web + "/");
  const ownerToken = (await context.cookies(web)).find(cookie => cookie.name === "przemai-session")?.value;
  assert.ok(ownerToken);
  const investment = companies.Dekonica.investment;
  await page.locator('a[href="/company/' + companies.Dekonica.id + '/investments/' + investment.id + '"]').click();
  await page.getByRole("heading", { name: investment.name, exact: true }).waitFor();
  await page.getByRole("link", { name: "General Agent", exact: true }).click();
  await page.waitForFunction(name => document.querySelector("textarea")?.value.includes(name), investment.name);
  assert.equal(await page.getByLabel("Zakres").inputValue(), companies.Dekonica.id);
  const scope = page.getByLabel("Zakres");
  const sendFor = async (company, excluded) => {
    await scope.selectOption(companies[company].id);
    await page.getByLabel("Wiadomość do asystenta").fill("Przygotuj raport sytuacji spółki");
    const posted = page.waitForResponse(r => r.request().method() === "POST" && r.url().endsWith("/api/chat"));
    await page.getByRole("button", { name: "Wyślij wiadomość" }).click();
    const response = await posted;
    assert.equal(response.status(), 200);
    const data = await response.json();
    assert.equal(data.pending, true);
    const answer = page.getByText("Faktura-" + company, { exact: false }).last();
    const reportButton = answer.getByRole("button", { name: "Pobierz raport" });
    await reportButton.waitFor();
    const content = await answer.textContent();
    for (const key of ["Faktura", "Dokument", "Przypisana"])
      assert.match(content, new RegExp(key + "-" + company));
    assert.doesNotMatch(content, new RegExp(excluded));
    const downloaded = page.waitForEvent("download");
    await reportButton.click();
    const download = await downloaded;
    assert.equal(download.suggestedFilename(), "raport-przemai.rtf");
    assert.match(await readFile(await download.path(), "utf8"), new RegExp("Faktura-" + company));
    return data.conversationId;
  };
  const conversation = await sendFor("Dekonica", "Deherus");
  assert.equal(await sendFor("Deherus", "Dekonica"), conversation);
  await context.close();

  const reopened = await browser.newContext({ viewport: { width: 1360, height: 920 } });
  await reopened.addCookies([{ name: "przemai-session", value: ownerToken, url: web, httpOnly: true, sameSite: "Strict" }]);
  const next = await reopened.newPage();
  await next.goto(web + "/chat");
  await next.getByRole("button", { name: /Rozmowa firmowa/ }).first().click();
  await next.getByText("Faktura-Deherus", { exact: false }).waitFor();
  assert.equal(await next.getByLabel("Zakres").inputValue(), companies.Deherus.id);
  await reopened.close();
  return { conversation, ownerToken };
}

async function main() {
  const dbUrl = new URL(process.env.DATABASE_URL);
  assert.equal(dbUrl.protocol, "postgresql:");
  assert.equal(dbUrl.hostname, "127.0.0.1");
  assert.match(dbUrl.pathname, /^\/przemai_p0_e2e_[a-z0-9_]+$/);
  const { chromium } = require("playwright");
  const db = require("../lib/prisma");
  const cwd = await mkdtemp(path.join(tmpdir(), "przemai-p0-"));
  const mock = openAIMock();
  let browser;
  try {
    mock.listen(0, "127.0.0.1");
    await once(mock, "listening");
    const backendEnv = {
      DATABASE_URL: dbUrl.href, NODE_OPTIONS: process.env.NODE_OPTIONS || "",
      ...(process.env.PRZEMAI_E2E_PRISMA_TOOLS && { PRZEMAI_E2E_PRISMA_TOOLS: process.env.PRZEMAI_E2E_PRISMA_TOOLS }),
      JWT_SECRET: jwtSecret, PORT: "3031", FRONTEND_URL: web,
      OPENAI_API_KEY: "local-mock-only",
      OPENAI_PRICE_BOUNDS_JSON: JSON.stringify({ "gpt-5.5": { input: 1, output: 1, validUntil: new Date(Date.now() + 3600000).toISOString() } }),
      OPENAI_BASE_URL: "http://127.0.0.1:" + mock.address().port + "/v1",
      TELEGRAM_NOTIFICATIONS_ENABLED: "false"
    };
    const startBackend = () => start(process.execPath, [path.join(repo, "server.js")], cwd, backendEnv);
    const { users, companies } = await seed(db);
    backend = startBackend();
    await ready(api + "/health");
    start(process.execPath, [path.join(repo, "frontend/node_modules/next/dist/bin/next"),
      "dev", path.join(repo, "frontend"), "--hostname", "127.0.0.1", "--port", "3034"], cwd, {
      NODE_ENV: "development", API_PROXY_TARGET: api, NEXT_TELEMETRY_DISABLED: "1",
      RAYON_NUM_THREADS: "2"
    });
    await ready(web + "/login");
    browser = await chromium.launch({
      executablePath: process.env.PRZEMAI_CHROMIUM,
      args: ["--no-sandbox"], headless: true
    });
    const { conversation, ownerToken } = await browserFlow(browser, users.owner, companies);
    assert.equal(requests.length, 6);
    assert.doesNotMatch(JSON.stringify(requests), /sk-syntheticE2E123/);
    console.log("WWW: login, two company scopes, three-agent plans, reopening without AI calls OK");

    const memoryRequest = { token: ownerToken, body: {
      requestId: randomUUID(), message: "Zapamiętaj, że wolę krótkie raporty"
    } };
    for (let replay = 0; replay < 2; replay++) {
      const memory = await json("/api/chat", memoryRequest);
      assert.equal(memory.status, 200);
      assert.match(memory.data.answer, /Zapamiętałem/);
    }
    assert.equal(await db.memory.count({ where: { userId: users.owner.id, content: "wolę krótkie raporty" } }), 1);
    assert.equal(await db.memory.count({ where: { userId: users.member.id } }), 0);
    assert.equal(requests.length, 6);
    console.log("Personal memory persists independently of model calls and deduplicates replay OK");

    const token = await tokenFor(users.member);
    const memberRequest = { organizationId: companies.Dekonica.id,
      requestId: randomUUID(), message: "Przeanalizuj inwestycje" };
    const makeRequest = () => json("/api/chat", { token, body: memberRequest });
    const [first, duplicate] = await Promise.all([makeRequest(), makeRequest()]);
    assert.equal(first.status, 200);
    assert.equal(duplicate.status, 200);
    assert.equal(first.data.conversationId, duplicate.data.conversationId);
    const memberUrl = "/api/chat/" + first.data.conversationId;
    assert.equal((await json("/api/chat/" + conversation, { token })).status, 404);
    let saved = await json(memberUrl, { token });
    assert.equal(saved.data.conversation.messages.length, 2);
    assert.match(JSON.stringify(saved.data), /Przypisana-Dekonica/);
    assert.doesNotMatch(JSON.stringify(saved.data), /Nieprzypisana|Deherus/);
    assert.equal(requests.length, 7);
    const conflict = await json("/api/chat", { token, body: { ...memberRequest, message: "Zmień inwestycję" } });
    assert.equal(conflict.status, 409);
    const denied = await json("/api/chat", { token, body: {
      organizationId: companies.Deherus.id, requestId: randomUUID(), message: memberRequest.message
    } });
    assert.equal(denied.status, 403);
    assert.doesNotMatch(JSON.stringify(denied.data), /Przypisana-Deherus/);
    await db.organizationInvestment.update({ where: { id: companies.Dekonica.investment.id },
      data: { assignedUserIds: [] } });
    saved = await json(memberUrl, { token });
    assert.match(JSON.stringify(saved.data), /brak dostępu/);
    assert.doesNotMatch(JSON.stringify(saved.data), /Przypisana-Dekonica/);
    assert.equal(requests.length, 7);
    console.log("Parallel duplicate, conflicting request, assigned-only and revoked investment access OK");

    const budgetToken = await tokenFor(users.budget);
    const budget = await Promise.all(Array.from({ length: 5 }, () => json("/api/chat", {
      token: budgetToken, body: { organizationId: companies.Dekonica.id, requestId: randomUUID(),
        message: "Porównaj faktury, dokumenty i inwestycje" }
    })));
    assert.deepEqual(budget.map(item => item.status).sort(), [200, 200, 200, 200, 429]);
    assert.equal(requests.length, 19);
    assert.ok(requests.every(request => request.max_output_tokens === 1000));
    const budgetConversation = budget.find(item => item.status === 200).data.conversationId;
    await db.organizationMembership.update({
      where: { organizationId_userId: { organizationId: companies.Dekonica.id, userId: users.budget.id } },
      data: { financeAccess: false }
    });
    const financeRevoked = await json("/api/chat/" + budgetConversation, { token: budgetToken });
    assert.doesNotMatch(JSON.stringify(financeRevoked.data), /Faktura-Dekonica/);
    assert.match(JSON.stringify(financeRevoked.data), /Dokument-Dekonica/);
    assert.equal(requests.length, 19);
    console.log("Parallel user budget: 12 calls max, four accepted plans and one HTTP 429 OK");

    await stop(backend);
    const { dispatchPlan } = require("../api/services/MultiAgentDispatchService");
    const planId = "restart-" + randomUUID();
    const queued = await dispatchPlan({ userId: users.owner.id, db,
      general: { conversationId: conversation, organizationId: companies.Deherus.id, planId },
      payload: { title: "Zlecenie do wznowienia", assignments: [
        { agentKey: "investment", instruction: "Przeanalizuj inwestycje" }
      ] }
    });
    assert.equal(queued.assignments[0].status, "TODO");
    backend = startBackend();
    await ready(api + "/health");
    const statusRequest = () => json("/api/chat", { token: ownerToken, body: {
      conversationId: conversation, organizationId: companies.Deherus.id,
      requestId: randomUUID(), message: "Status"
    } });
    const resumed = await statusRequest();
    assert.match(resumed.data.answer, /Przypisana-Deherus/);
    assert.equal(requests.length, 20);
    await statusRequest();
    assert.equal(requests.length, 20);
    await db.organizationMembership.update({
      where: { organizationId_userId: { organizationId: companies.Deherus.id, userId: users.owner.id } },
      data: { status: "REVOKED" }
    });
    const afterRevocation = await json("/api/chat/" + conversation, { token: ownerToken });
    assert.doesNotMatch(JSON.stringify(afterRevocation.data), /Faktura-Deherus|Przypisana-Deherus|Dokument-Deherus/);
    assert.match(JSON.stringify(afterRevocation.data), /Faktura-Dekonica/);
    console.log("Queued plan resumes after backend restart; completed plan remains single-shot and revoked company results are hidden OK");
  } finally {
    await browser?.close();
    await Promise.all([...children].map(stop));
    mock.close();
    await db.$disconnect();
    await rm(cwd, { recursive: true, force: true });
  }
}

main().catch(error => { console.error(error.stack); process.exitCode = 1; });
