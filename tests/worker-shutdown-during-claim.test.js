"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "../worker.js"), "utf8");
const settled = () => new Promise(resolve => setImmediate(resolve));

test("SIGTERM during an in-flight agent claim releases the claim without starting the agent", async () => {
  let releaseClaim;
  const claimPending = new Promise(resolve => { releaseClaim = resolve; });
  const handlers = {};
  const events = { updates: [], runs: 0, disconnects: 0, exits: [], errors: [] };
  const agent = { id: "claimed-agent", key: "financial", userId: "staging-user", enabled: true };
  const prisma = {
    user: { async findMany() { return [{ id: "staging-user" }]; } },
    agent: {
      async findMany({ where }) {
        return where.status === "RUNNING" ? [] : [agent];
      },
      async updateMany(args) {
        events.updates.push(args);
        if (events.updates.length === 1) await claimPending;
        return { count: 1 };
      }
    },
    agentRun: { async updateMany() { throw new Error("unexpected audit"); } },
    async $disconnect() { events.disconnects += 1; }
  };
  const dependencies = {
    dotenv: { config() {} },
    "./lib/prisma": prisma,
    "./core/agents/AgentRunner": class {
      async run() { events.runs += 1; }
    },
    "./api/services/AgentService": class { async ensureDefaults() {} }
  };

  vm.runInNewContext(source, {
    require(name) {
      if (!Object.hasOwn(dependencies, name)) throw new Error("Unexpected dependency: " + name);
      return dependencies[name];
    },
    console: {
      log() {}, warn() {},
      error(...args) { events.errors.push(args); }
    },
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

  await settled();
  assert.equal(events.updates.length, 1, "agent claim should be pending");
  const shutdown = handlers.SIGTERM();
  assert.equal(events.disconnects, 0, "do not disconnect while claim is pending");
  releaseClaim();
  await shutdown;

  assert.equal(events.runs, 0, "never start a newly claimed agent after SIGTERM");
  assert.equal(events.updates.length, 2, "release the claim without waiting for stale recovery");
  assert.equal(events.updates[1].where.id, agent.id);
  assert.equal(events.updates[1].where.status, "RUNNING");
  assert.equal(events.updates[1].data.status, "IDLE");
  assert.ok(events.updates[1].data.nextRunAt instanceof Date);
  assert.equal(events.disconnects, 1);
  assert.deepEqual(events.exits, [0]);
  assert.equal(events.errors.length, 0);
});
