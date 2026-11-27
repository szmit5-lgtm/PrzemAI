"use strict";

const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const { once } = require("node:events");
const { setTimeout: delay } = require("node:timers/promises");
const { randomUUID } = require("node:crypto");
const path = require("node:path");
const jwt = require("jsonwebtoken");

async function main() {
  const database = new URL(process.env.DATABASE_URL);
  assert.equal(database.protocol, "postgresql:");
  assert.equal(database.hostname, "127.0.0.1");
  assert.match(database.pathname, /^\/przemai_p0_e2e_restore_[a-f0-9]{12}$/);
  assert.equal(database.search + database.hash, "");
  const db = require("../lib/prisma");
  const children = new Set();
  const owner = "cutover-owner";
  const secret = randomUUID();
  const port = 3919;

  function start(cwd, entry, extra) {
    const child = spawn(process.execPath, [path.join(cwd, entry)], {
      cwd: path.dirname(process.argv[2]), env: {
        PATH: process.env.PATH, DATABASE_URL: database.href,
        JWT_SECRET: secret, PORT: String(port),
        OPENAI_DAILY_REQUEST_LIMIT: "0", OPENAI_MONTHLY_BUDGET_PLN: "0",
        KSEF_SYNC_ENABLED: "false", TELEGRAM_NOTIFICATIONS_ENABLED: "false", ...extra
      }, stdio: ["ignore", "pipe", "pipe"]
    });
    const processState = { child, exited: once(child, "exit"), log: "" };
    children.add(processState);
    for (const stream of [child.stdout, child.stderr]) stream.on("data", chunk => { processState.log += chunk; });
    return processState;
  }

  async function ready(instance, check) {
    for (let i = 0; i < 100; i++) {
      if (instance.child.exitCode !== null) break;
      if (await check()) return;
      await delay(200);
    }
    assert.fail(instance.log || "Process startup timed out");
  }

  async function stop(instance) {
    instance.child.kill("SIGTERM");
    const result = await Promise.race([instance.exited, delay(30000, null, { ref: false })]);
    if (!result) instance.child.kill("SIGKILL");
    await instance.exited;
    children.delete(instance);
    return result;
  }

  async function get(route, id) {
    const response = await fetch("http://127.0.0.1:" + port + route, {
      headers: { Authorization: "Bearer " + jwt.sign({ id }, secret) }, signal: AbortSignal.timeout(1000)
    });
    return { status: response.status, body: await response.json() };
  }

  try {
    assert.equal((await db.chatConversation.findUniqueOrThrow({ where: { id: "cutover-web" } })).channel, "WEB");
    const [member, outsider] = await Promise.all(["member", "outsider"].map(role =>
      db.user.create({ data: { email: role + "@cutover.example.test", password: "fixture" } })));
    const org = await db.organization.create({ data: {
      name: "Cutover", slug: "cutover-fixture",
      memberships: { create: [{ userId: owner, role: "OWNER" }, { userId: member.id, role: "MEMBER" }] }
    } });
    const [mielno, zgorzelec] = await Promise.all(["Mielno", "Zgorzelec"].map(name =>
      db.organizationInvestment.create({ data: {
        name, organizationId: org.id, assignedUserIds: name === "Mielno" ? [member.id] : []
      } })));
    const { OrganizationService } = require("../api/services/OrganizationService");
    const task = await new OrganizationService({ db }).createCompanyTask(owner, org.id, { title: "Private Zgorzelec task" }, zgorzelec.id);
    await db.chatConversation.create({ data: { id: "cutover-telegram", userId: owner, title: "Telegram fixture", channel: "TELEGRAM" } });
    const stale = new Date(Date.now() - 2 * 60 * 60000);
    await db.agent.create({ data: { userId: owner, key: "financial", name: "Financial", type: "FINANCIAL", enabled: false } });
    const scheduled = await db.agent.create({ data: {
      userId: owner, key: "document", name: "Document", type: "DOCUMENT",
      status: "RUNNING", updatedAt: stale, intervalMinutes: 30,
      runs: { create: { status: "RUNNING", trigger: "SCHEDULE", startedAt: stale } }
    } });
    const scheduledRuns = async () => (await db.agentRun.findMany({
      where: { agentId: scheduled.id }, orderBy: { startedAt: "asc" }, select: { status: true }
    })).map(run => run.status);
    const [draft, queued, done] = await Promise.all([
      { title: "Interrupted draft", source: "AGENT", status: "IN_PROGRESS", startedAt: stale, updatedAt: stale, metadata: { agentKey: "document" } },
      { title: "Queued plan", source: "GENERAL_AGENT", status: "TODO" },
      { title: "Completed plan", source: "GENERAL_AGENT", status: "DONE" }
    ].map(data => db.task.create({ data: { userId: owner, tags: [], ...data } })));
    const statuses = async () => Promise.all([draft, queued, done].map(async row =>
      (await db.task.findUniqueOrThrow({ where: { id: row.id } })).status));

    const oldWorker = start(process.argv[3], "worker.js", { WORKER_OWNER_USER_ID: owner });
    const cycle = instance => /\[Worker\] Cycle .*"users":1,.*"failed":0,/.test(instance.log);
    await ready(oldWorker, () => cycle(oldWorker));
    assert.deepEqual(await statuses(), ["IN_PROGRESS", "TODO", "DONE"]);
    assert.deepEqual(await scheduledRuns(), ["FAILED", "SUCCESS"]);
    assert.deepEqual(await stop(oldWorker), [0, null]);
    console.log("Production worker reads P0 schema and drains on SIGTERM, but leaves interrupted P0 drafts unhandled");

    const workspace = "/api/organizations/" + org.id + "/workspace";
    const oldApi = start(process.argv[2], "server.js");
    const healthy = () => get("/health", owner).then(result => result.status === 200).catch(() => false);
    await ready(oldApi, healthy);
    assert.equal((await get(workspace, outsider.id)).status, 403);
    const oldWorkspace = await get(workspace, member.id);
    assert.equal(oldWorkspace.status, 200);
    assert.ok(oldWorkspace.body.data.tasks.some(row => row.id === task.id));
    const oldChat = await get("/api/chat", owner);
    assert.equal(oldChat.status, 200);
    assert.ok(oldChat.body.conversations.some(row => row.id === "cutover-telegram"));
    await stop(oldApi);
    console.log("Production API reads P0 schema but exposes Telegram history and unassigned investment tasks");

    const candidate = path.resolve(__dirname, "..");
    for (let iteration = 0; iteration < 2; iteration++) {
      const worker = start(candidate, "worker.js", { WORKER_OWNER_USER_ID: owner });
      await ready(worker, () => cycle(worker));
      assert.deepEqual(await statuses(), ["ERROR", "TODO", "DONE"]);
      assert.deepEqual(await scheduledRuns(), ["FAILED", "SUCCESS"]);
      assert.deepEqual(await stop(worker), [0, null]);
    }
    const api = start(candidate, "server.js");
    await ready(api, healthy);
    const nextWorkspace = await get(workspace, member.id);
    assert.equal(nextWorkspace.status, 200);
    assert.ok(!nextWorkspace.body.data.tasks.some(row => row.id === task.id));
    assert.equal((await get(workspace, outsider.id)).status, 403);
    const investments = "/api/organizations/" + org.id + "/investments/";
    assert.equal((await get(investments + mielno.id, member.id)).status, 200);
    assert.equal((await get(investments + zgorzelec.id, member.id)).status, 404);
    assert.equal((await get("/api/chat/cutover-telegram", owner)).status, 404);
    assert.equal((await get("/api/chat/cutover-web", owner)).status, 200);
    await stop(api);
    assert.equal((await db.task.findUniqueOrThrow({ where: { id: "cutover-legacy-queue" } })).status, "TODO");
    const { checkBudget } = require("./check-ai-release-budget");
    await checkBudget(db, {
      OPENAI_API_KEY: "fixture",
      OPENAI_DAILY_REQUEST_LIMIT: "12",
      OPENAI_MONTHLY_BUDGET_PLN: "1",
      OPENAI_PRICE_BOUNDS_JSON: JSON.stringify({
        "gpt-5.5": { input: 1, output: 1, validUntil: new Date(Date.now() + 60000).toISOString() }
      })
    });
    console.log("P0 cutover preserves queued/completed work, quarantines interrupted drafts and enforces tenant/channel isolation");
  } finally {
    await Promise.all([...children].map(stop));
    await db.$disconnect();
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
