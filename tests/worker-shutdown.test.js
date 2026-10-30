"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "../worker.js"), "utf8");
const settled = () => new Promise(resolve => setImmediate(resolve));

test("SIGTERM waits for an active cycle and prevents new agent work", async () => {
  let releaseUserRead;
  const blockedRead = new Promise(resolve => { releaseUserRead = resolve; });
  const handlers = {};
  const events = {
    userReads: 0, dueReads: 0, ensured: 0, runs: 0,
    disconnects: 0, exits: [], cleared: 0, tick: null
  };

  const prisma = {
    user: {
      async findMany() {
        events.userReads += 1;
        await blockedRead;
        return [{ id: "staging-user" }];
      }
    },
    agent: {
      async findMany({ where }) {
        if (where.status === "RUNNING") return [];
        events.dueReads += 1;
        return [{ id: "agent-1", key: "financial", enabled: true }];
      },
      async updateMany() { throw new Error("must not claim agents during shutdown"); }
    },
    agentRun: { async updateMany() { throw new Error("unexpected audit update"); } },
    async $disconnect() { events.disconnects += 1; }
  };
  const dependencies = {
    dotenv: { config() {} },
    "./lib/prisma": prisma,
    "./core/agents/AgentRunner": class {
      async run() { events.runs += 1; }
    },
    "./api/services/AgentService": class {
      async ensureDefaults() { events.ensured += 1; }
    }
  };

  vm.runInNewContext(source, {
    require(name) {
      if (!Object.hasOwn(dependencies, name)) throw new Error("Unexpected dependency: " + name);
      return dependencies[name];
    },
    console: { log() {}, warn() {}, error(message) { throw new Error(message); } },
    process: {
      env: {},
      on(signal, handler) { handlers[signal] = handler; },
      exit(code) { events.exits.push(code); }
    },
    Date,
    setInterval(callback) { events.tick = callback; return 1; },
    clearInterval() { events.cleared += 1; },
    setTimeout
  }, { filename: "worker.js" });

  await settled();
  assert.equal(events.userReads, 1);
  assert.equal(typeof handlers.SIGTERM, "function");
  assert.equal(typeof events.tick, "function");

  const shutdown = handlers.SIGTERM();
  assert.equal(events.cleared, 1);
  assert.equal(events.disconnects, 0, "do not disconnect while the cycle is active");

  events.tick();
  await settled();
  assert.equal(events.userReads, 1, "timer ticks after SIGTERM must not start work");

  releaseUserRead();
  await shutdown;

  assert.equal(events.ensured, 0, "shutdown must skip user provisioning");
  assert.equal(events.dueReads, 0, "shutdown must skip due-agent scans");
  assert.equal(events.runs, 0);
  assert.equal(events.disconnects, 1);
  assert.deepEqual(events.exits, [0]);

  await handlers.SIGINT();
  assert.equal(events.disconnects, 1, "repeated signals must not disconnect twice");
  assert.equal(events.cleared, 1);
});
