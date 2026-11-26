"use strict";
const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const { randomUUID } = require("node:crypto");
const { once } = require("node:events");
const { mkdtemp, rm } = require("node:fs/promises");
const { tmpdir } = require("node:os");
const path = require("node:path");

async function main() {
  const url = new URL(process.env.DATABASE_URL);
  assert.equal(url.protocol, "postgresql:");
  assert.equal(url.hostname, "127.0.0.1");
  assert.match(url.pathname, /^\/przemai_p0_e2e_[a-z0-9_]+$/);
  const db = require("../lib/prisma");
  const { openAIRequestPolicy } = require("../lib/openAIRequestPolicy");
  const { OrganizationService } = require("../api/services/OrganizationService");
  const { OrganizationInvestmentService } = require("../api/services/OrganizationInvestmentService");
  const temp = await mkdtemp(path.join(tmpdir(), "przem-release-e2e-"));
  const suffix = randomUUID();
  const workers = new Map();

  function startWorker(ownerId) {
    const child = spawn(process.execPath, [path.resolve(__dirname, "../worker.js")], {
      cwd: temp, env: {
        DATABASE_URL: url.href, NODE_OPTIONS: process.env.NODE_OPTIONS || "",
        PRZEMAI_E2E_PRISMA_TOOLS: process.env.PRZEMAI_E2E_PRISMA_TOOLS || "",
        WORKER_OWNER_USER_ID: ownerId, OPENAI_DAILY_REQUEST_LIMIT: "0",
        KSEF_SYNC_ENABLED: "false", KSEF_DEHERUS_SYNC_ENABLED: "false"
      }, stdio: ["ignore", "pipe", "pipe"]
    });
    const exited = once(child, "exit");
    let log = "";
    child.stdout.on("data", chunk => { log += chunk; });
    child.stderr.on("data", chunk => { log += chunk; });
    workers.set(child, exited);
    return { child, exited, log: () => log };
  }

  async function stopWorker(worker) {
    worker.child.kill("SIGTERM");
    assert.deepEqual(await worker.exited, [0, null], worker.log());
    workers.delete(worker.child);
  }

  try {
    const [owner, employee] = await Promise.all(["owner", "leszek"].map(role => db.user.create({
      data: { email: role + "-" + suffix + "@example.test", password: "synthetic" }
    })));
    const company = await db.organization.create({ data: {
      name: "Dekonica", slug: "dekonica-" + suffix,
      memberships: { create: [{ userId: owner.id, role: "OWNER" }, { userId: employee.id, role: "MEMBER" }] }
    } });
    const other = await db.organization.create({ data: { name: "Deherus", slug: "deherus-" + suffix } });
    const [mielno, zgorzelec] = await Promise.all(["Mielno", "Zgorzelec"].map(name =>
      db.organizationInvestment.create({ data: {
        name, organizationId: company.id, assignedUserIds: name === "Mielno" ? [employee.id] : []
      } })));
    const organizations = new OrganizationService({ db });
    const task = await organizations.createCompanyTask(owner.id, company.id, { title: "Zadanie Mielno" }, mielno.id);
    const document = await db.organizationDocument.create({ data: {
      organizationId: company.id, investmentId: mielno.id, name: "Protokół.txt",
      content: Buffer.from("synthetic"), contentType: "text/plain", sha256: "e2e-" + suffix, size: 9
    } });
    const investments = new OrganizationInvestmentService({ db });
    assert.equal((await investments.panel(employee.id, company.id, mielno.id)).documents[0].id, document.id);
    await assert.rejects(investments.panel(employee.id, company.id, zgorzelec.id), { status: 404 });
    await assert.rejects(investments.panel(employee.id, other.id, mielno.id), { status: 403 });
    await db.organizationInvestment.delete({ where: { id: mielno.id } });
    const preserved = await db.task.findUniqueOrThrow({ where: { id: task.id } });
    assert.equal(preserved.investmentId, null);
    assert.equal(preserved.investmentScoped, true);
    assert.ok(!(await organizations.workspace(employee.id, company.id)).tasks.some(row => row.id === task.id));
    await assert.rejects(organizations.setCompanyTaskStatus(employee.id, company.id, task.id, "DONE"), { status: 404 });
    assert.equal((await db.organizationDocument.findUniqueOrThrow({ where: { id: document.id } })).investmentId, null);

    const stale = new Date(Date.now() - 2 * 60 * 60000);
    const agent = await db.agent.create({ data: {
      userId: owner.id, key: "financial", type: "FINANCIAL", name: "Financial Agent",
      enabled: true, status: "RUNNING", updatedAt: stale,
      runs: { create: { status: "RUNNING", trigger: "SCHEDULE", startedAt: stale } }
    } });
    const draft = await db.task.create({ data: {
      userId: owner.id, title: "Przerwany szkic", tags: [], source: "AGENT", status: "IN_PROGRESS",
      startedAt: stale, updatedAt: stale, metadata: { agentKey: "document" }
    } });
    const first = startWorker(owner.id);
    const second = startWorker(owner.id);
    for (let attempt = 0; attempt < 50; attempt++) {
      if (first.log().includes("[Worker] Cycle") && second.log().includes("[Worker] Cycle") &&
          await db.agentRun.count({ where: { agentId: agent.id, status: "SUCCESS" } })) break;
      await new Promise(resolve => setTimeout(resolve, 300));
    }
    await Promise.all([stopWorker(first), stopWorker(second)]);
    const third = startWorker(owner.id);
    for (let attempt = 0; attempt < 50 && !third.log().includes("[Worker] Cycle"); attempt++)
      await new Promise(resolve => setTimeout(resolve, 300));
    assert.match(third.log(), /\[Worker\] Cycle/);
    await stopWorker(third);
    assert.deepEqual((await db.agentRun.findMany({ where: { agentId: agent.id },
      orderBy: { startedAt: "asc" }, select: { status: true } })).map(run => run.status), ["FAILED", "SUCCESS"]);
    assert.equal((await db.task.findUniqueOrThrow({ where: { id: draft.id } })).status, "ERROR");

    const rows = await db.$queryRaw`SELECT "requests" FROM "OpenAIRequestBudget"
      WHERE "day" = (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::date`;
    const limit = () => (rows[0]?.requests || 0) + 2;
    let providerCalls = 0;
    const options = { db, limit, fetchRequest: async () => { providerCalls++; return new Response(); } };
    const requests = Array.from({ length: 10 }, () => openAIRequestPolicy(options).fetch("http://127.0.0.1"));
    const results = await Promise.allSettled(requests);
    assert.equal(results.filter(result => result.status === "fulfilled").length, 2);
    assert.equal(providerCalls, 2);
    await assert.rejects(openAIRequestPolicy(options).fetch("http://127.0.0.1"), { code: "AI_DAILY_REQUEST_LIMIT" });
    console.log("Release E2E: access and SET NULL, concurrent worker recovery/restart, shared atomic AI limit passed");
  } finally {
    for (const child of workers.keys()) child.kill("SIGTERM");
    await Promise.allSettled(workers.values());
    await db.$disconnect();
    await rm(temp, { recursive: true, force: true });
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
