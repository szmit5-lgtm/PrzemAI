"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

test("SIGTERM during stale recovery never reads or claims Kaldeva jobs", async () => {
  const source = fs.readFileSync(path.join(__dirname, "../worker.js"), "utf8");
  let release;
  let signal;
  const blocked = new Promise(resolve => { release = resolve; });
  const events = { queueReads: 0, claims: 0, userReads: 0, disconnects: 0, exits: [] };
  const prisma = {
    agent: { async findMany() { await blocked; return []; }, async updateMany() { throw Error("unexpected claim"); } },
    agentRun: { async updateMany() { throw Error("unexpected audit"); } },
    history: { async findMany() { events.queueReads++; return []; } },
    user: { async findMany() { events.userReads++; return []; } },
    async $executeRaw() { events.claims++; return 1; },
    async $disconnect() { events.disconnects++; }
  };
  const deps = {
    dotenv: { config() {} },
    "./lib/prisma": prisma,
    "./core/agents/AgentRunner": class {},
    "./api/services/AgentService": class {},
    "./publicLeadDiscovery": { discoverPublicLeads: async () => ({ leads: [] }) },
    "./publicCompanySearch": { searchPublicCompanies: async () => [] },
    "./salesLeadPipeline": { buildSalesLeadReport: () => ({}) }
  };
  vm.runInNewContext(source, {
    require(name) {
      if (!Object.hasOwn(deps, name)) throw Error("Unexpected dependency: " + name);
      return deps[name];
    },
    process: { env: {}, on(name, fn) { if (name === "SIGTERM") signal = fn; }, exit(code) { events.exits.push(code); } },
    console: { log() {}, warn() {}, error() {} },
    Date, setTimeout, setInterval() { return 1; }, clearInterval() {}
  }, { filename: "worker.js" });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(typeof signal, "function");
  const shutdown = signal();
  release();
  await shutdown;
  assert.equal(events.queueReads, 0);
  assert.equal(events.claims, 0);
  assert.equal(events.userReads, 0);
  assert.equal(events.disconnects, 1);
  assert.deepEqual(events.exits, [0]);
});
