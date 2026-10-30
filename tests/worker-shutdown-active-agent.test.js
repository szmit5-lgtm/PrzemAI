"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "../worker.js"), "utf8");
const settled = () => new Promise(resolve => setImmediate(resolve));

test("SIGTERM lets an already-running agent finish before disconnecting and never starts another", async () => {
  let releaseRun;
  const activeRun = new Promise(resolve => { releaseRun = resolve; });
  const handlers = {};
  const events = {
    started: [], finished: [], disconnected: 0, exits: [], cleared: 0,
    tick: null, dueReads: 0
  };
  const agent = { id: "active-agent", key: "financial", userId: "staging-user", enabled: true };
  const prisma = {
    user: { async findMany() { return [{ id: "staging-user" }]; } },
    agent: {
      async findMany({ where }) {
        if (where.status === "RUNNING") return [];
        events.dueReads += 1;
        return [agent];
      },
      async updateMany() { return { count: 1 }; }
    },
    agentRun: { async updateMany() { throw new Error("unexpected stale audit"); } },
    async $disconnect() { events.disconnected += 1; }
  };
  const dependencies = {
    dotenv: { config() {} },
    "./lib/prisma": prisma,
    "./core/agents/AgentRunner": class {
      async run(item) {
        events.started.push(item.id);
        await activeRun;
        events.finished.push(item.id);
      }
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
      error(...args) { throw new Error("Unexpected worker error: " + args[0]); }
    },
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
  assert.deepEqual(events.started, ["active-agent"]);
  assert.deepEqual(events.finished, []);
  assert.equal(events.dueReads, 1);

  const shutdown = handlers.SIGTERM();
  events.tick();
  await settled();
  assert.equal(events.disconnected, 0, "database connection must stay open for the active agent");
  assert.deepEqual(events.started, ["active-agent"], "shutdown must not start another run");
  assert.equal(events.dueReads, 1, "shutdown must not scan due agents again");

  releaseRun();
  await shutdown;
  assert.deepEqual(events.finished, ["active-agent"]);
  assert.equal(events.disconnected, 1);
  assert.deepEqual(events.exits, [0]);
  assert.equal(events.cleared, 1);
});
