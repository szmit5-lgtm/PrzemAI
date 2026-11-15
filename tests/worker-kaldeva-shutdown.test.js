"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "../worker.js"), "utf8");
const settled = () => new Promise(resolve => setImmediate(resolve));

test("SIGTERM during Kaldeva queue scan never claims or searches queued jobs", async () => {
  let releaseQueue;
  let notifyQueue;
  const queueReached = new Promise(resolve => { notifyQueue = resolve; });
  const queueBlocked = new Promise(resolve => { releaseQueue = resolve; });
  const events = { claims: 0, searches: 0, disconnects: 0, exits: [], errors: [] };
  const handlers = {};
  const prisma = {
    agent: { async findMany() { return []; } },
    history: {
      async findMany({ where }) {
        if (where.report.equals === "queued") {
          notifyQueue();
          await queueBlocked;
          return [{ id: "queued-1", userId: "owner-1", report: {
            status: "queued", actorId: "owner-1", companyId: "kaldeva:owner-1",
            query: "test query"
          } }];
        }
        return [];
      }
    },
    async $executeRaw() { events.claims++; return 1; },
    user: { async findMany() { return []; } },
    async $disconnect() { events.disconnects++; }
  };
  const dependencies = {
    dotenv: { config() {} },
    "./lib/prisma": prisma,
    "./core/agents/AgentRunner": class {},
    "./api/services/AgentService": class {},
    "./publicLeadDiscovery": { discoverPublicLeads: async () => { events.searches++; return { leads: [] }; } },
    "./publicCompanySearch": { searchPublicCompanies: async () => [] },
    "./salesLeadPipeline": { buildSalesLeadReport: () => ({}) }
  };
  vm.runInNewContext(source, {
    require(name) {
      if (!Object.hasOwn(dependencies, name)) throw new Error("Unexpected dependency: " + name);
      return dependencies[name];
    },
    console: { log() {}, warn() {}, error(...args) { events.errors.push(args); } },
    process: {
      env: {},
      on(signal, handler) { handlers[signal] = handler; },
      exit(code) { events.exits.push(code); }
    },
    Date,
    setInterval() { return 1; },
    clearInterval() {},
    setTimeout
  }, { filename: "worker.js" });

  await queueReached;
  const shutdown = handlers.SIGTERM();
  releaseQueue();
  await settled();
  await shutdown;

  assert.equal(events.claims, 0, "queued job must not be claimed after SIGTERM");
  assert.equal(events.searches, 0, "search must not begin after SIGTERM");
  assert.equal(events.disconnects, 1);
  assert.deepEqual(events.exits, [0]);
  assert.deepEqual(events.errors, []);
});
