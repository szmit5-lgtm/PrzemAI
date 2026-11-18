"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

test("SIGTERM during stale recovery does not read or claim Kaldeva queue", async () => {
  let releaseScan;
  const blocked = new Promise(resolve => { releaseScan = resolve; });
  const handlers = {};
  let staleReads = 0;
  let queueReads = 0;
  let userReads = 0;
  let disconnects = 0;
  const prisma = {
    agent: { async findMany() {
      staleReads++;
      await blocked;
      return [];
    } },
    history: { async findMany() { queueReads++; return []; } },
    user: { async findMany() { userReads++; return []; } },
    async $disconnect() { disconnects++; }
  };
  const deps = {
    dotenv: { config() {} },
    "./lib/prisma": prisma,
    "./core/agents/AgentRunner": class {},
    "./api/services/AgentService": class {},
    "./publicLeadDiscovery": { discoverPublicLeads: async () => ({ leads: [] }) },
    "./publicCompanySearch": { searchPublicCompanies: async () => [] },
    "./salesLeadPipeline": { buildSalesLeadReport: () => ({}) },
    "./scripts/sendSpecpozOnce": () => async () => {}
  };
  const source = fs.readFileSync(path.join(__dirname, "../worker.js"), "utf8");
  vm.runInNewContext(source, {
    require(name) {
      if (!Object.hasOwn(deps, name)) throw new Error("Unexpected dependency: " + name);
      return deps[name];
    },
    console: { log() {}, warn() {}, error() {} },
    process: {
      env: {},
      on(name, fn) { handlers[name] = fn; },
      exit() {}
    },
    Date,
    setInterval() { return 1; },
    clearInterval() {},
    setTimeout
  }, { filename: "worker.js" });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(staleReads, 1);
  const shutdown = handlers.SIGTERM();
  releaseScan();
  await shutdown;
  assert.equal(queueReads, 0, "Kaldeva queue must not be read after shutdown");
  assert.equal(userReads, 0, "user provisioning must not start after shutdown");
  assert.equal(disconnects, 1);
});
