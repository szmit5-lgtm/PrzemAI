"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "../worker.js"), "utf8");
const settled = () => new Promise(resolve => setImmediate(resolve));

function boot(staleCount, lostClaims = new Set()) {
  const pending = Array.from({ length: staleCount }, (_, index) => ({ id: `stale-${index}` }));
  const events = { claims: [], audits: [], scans: [], logs: [], tick: null };
  const prisma = {
    user: { findMany: async () => [] },
    agent: {
      async findMany(args) {
        if (args.where.status !== "RUNNING") return [];
        events.scans.push(args);
        return pending.slice(0, args.take);
      },
      async updateMany({ where }) {
        events.claims.push(where.id);
        if (lostClaims.has(where.id)) return { count: 0 };
        const index = pending.findIndex(item => item.id === where.id);
        if (index < 0) return { count: 0 };
        pending.splice(index, 1);
        return { count: 1 };
      }
    },
    agentRun: {
      async updateMany(args) {
        events.audits.push(args);
        return { count: 1 };
      }
    },
    $disconnect: async () => {}
  };
  const dependencies = {
    dotenv: { config() {} },
    "./lib/prisma": prisma,
    "./core/agents/AgentRunner": class { async run() { throw new Error("unexpected run"); } },
    "./api/services/AgentService": class { async ensureDefaults() { throw new Error("unexpected user"); } }
  };

  vm.runInNewContext(source, {
    require(name) {
      if (!Object.hasOwn(dependencies, name)) throw new Error(`Unexpected dependency: ${name}`);
      return dependencies[name];
    },
    console: {
      log: (...args) => events.logs.push(args),
      warn() {},
      error: (...args) => { throw new Error(`Unexpected worker error: ${args[0]}`); }
    },
    process: { env: {}, on() {}, exit() { throw new Error("unexpected exit"); } },
    Date,
    setInterval(callback) { events.tick = callback; return 1; },
    clearInterval() {},
    setTimeout
  }, { filename: "worker.js" });

  assert.equal(typeof events.tick, "function");
  return { pending, events };
}

test("stale-run recovery drains fifty plus one across two cycles without duplicate audits", async () => {
  const { pending, events } = boot(51);
  await settled();

  assert.equal(pending.length, 1);
  assert.equal(pending[0].id, "stale-50");
  assert.equal(events.audits.length, 50);
  assert.equal(events.scans[0].take, 50);
  assert.equal(events.scans[0].orderBy.updatedAt, "asc");
  assert.equal(JSON.parse(events.logs.find(item => item[0] === "[Worker] Cycle")[1]).recovered, 50);

  events.tick();
  await settled();

  assert.equal(pending.length, 0);
  assert.equal(events.audits.length, 51);
  assert.equal(new Set(events.audits.map(item => item.where.agentId)).size, 51);
  assert.equal(events.audits.at(-1).where.agentId, "stale-50");
  assert.equal(events.audits.at(-1).data.status, "FAILED");
});

test("lost stale-run claim is never counted or marked failed in audit", async () => {
  const { pending, events } = boot(2, new Set(["stale-0"]));
  await settled();

  assert.deepEqual(pending.map(item => item.id), ["stale-0"]);
  assert.deepEqual(events.audits.map(item => item.where.agentId), ["stale-1"]);
  const summary = JSON.parse(events.logs.find(item => item[0] === "[Worker] Cycle")[1]);
  assert.equal(summary.recovered, 1);
  assert.equal(summary.completed, 0);
});
