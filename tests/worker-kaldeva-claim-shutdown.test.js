"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

test("SIGTERM during Kaldeva claim releases the unstarted job without searching", async () => {
  const source = fs.readFileSync(path.join(__dirname, "../worker.js"), "utf8");
  let releaseClaim;
  const pendingClaim = new Promise(resolve => { releaseClaim = resolve; });
  const handlers = {};
  const writes = [];
  let searches = 0;
  let disconnects = 0;
  let userReads = 0;
  const job = {
    status: "queued", actorId: "synthetic-user",
    companyId: "kaldeva:synthetic-user", query: "synthetic"
  };
  const prisma = {
    history: {
      async findMany(args) {
        return args.where.report.path[0] === "queued"
          ? [{ id: "synthetic-job", userId: "synthetic-user", report: job }]
          : [];
      }
    },
    user: { async findMany() { userReads++; return []; } },
    agent: { async findMany() { return []; } },
    async $executeRaw(strings, ...values) {
      const report = JSON.parse(values[0]);
      writes.push(report.status);
      if (report.status === "running") await pendingClaim;
      return 1;
    },
    async $disconnect() { disconnects++; }
  };
  const dependencies = {
    dotenv: { config() {} },
    "./lib/prisma": prisma,
    "./core/agents/AgentRunner": class { async run() { throw Error("unexpected run"); } },
    "./api/services/AgentService": class { async ensureDefaults() { throw Error("unexpected provisioning"); } },
    "./publicLeadDiscovery": { async discoverPublicLeads() { searches++; throw Error("unexpected search"); } },
    "./publicCompanySearch": { async searchPublicCompanies() { return []; } },
    "./salesLeadPipeline": { buildSalesLeadReport() { return {}; } }
  };
  vm.runInNewContext(source, {
    require(name) {
      if (!Object.hasOwn(dependencies, name)) throw Error("Unexpected dependency: " + name);
      return dependencies[name];
    },
    process: { env: {}, on(signal, fn) { handlers[signal] = fn; }, exit() {} },
    console: { log() {}, warn() {}, error(...args) { throw Error(args.join(" ")); } },
    Date, setTimeout, clearInterval() {}, setInterval() { return 1; }
  }, { filename: "worker.js" });

  for (let i = 0; i < 20 && writes.length === 0; i++) {
    await new Promise(resolve => setImmediate(resolve));
  }
  assert.deepEqual(writes, ["running"], "claim must be in flight before SIGTERM");
  const shutdown = handlers.SIGTERM();
  releaseClaim();
  await shutdown;
  assert.deepEqual(writes, ["running", "queued"], "unstarted claim must return to queue");
  assert.equal(searches, 0, "shutdown must not start external discovery");
  assert.equal(userReads, 0, "shutdown must not start user provisioning");
  assert.equal(disconnects, 1);
});
