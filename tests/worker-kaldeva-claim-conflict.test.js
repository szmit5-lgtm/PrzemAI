"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

test("Kaldeva does not search or write results when another worker wins the claim", async () => {
  const source = fs.readFileSync(path.join(__dirname, "../worker.js"), "utf8");
  const handlers = {};
  const writes = [];
  let searches = 0;
  let userReads = 0;
  let disconnects = 0;
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
      writes.push(JSON.parse(values[0]).status);
      return 0; // A competing worker or cancellation already changed the row.
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

  for (let i = 0; i < 30 && userReads === 0; i++) {
    await new Promise(resolve => setImmediate(resolve));
  }
  assert.deepEqual(writes, ["running"], "only an atomic claim should be attempted");
  assert.equal(searches, 0, "a rejected claim must never trigger external discovery");
  assert.equal(userReads, 1, "worker should continue its normal cycle");
  await handlers.SIGTERM();
  assert.equal(disconnects, 1);
});
