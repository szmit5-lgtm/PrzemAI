"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "../worker.js"), "utf8");
const settled = () => new Promise(resolve => setImmediate(resolve));

test("SIGTERM during a stale-run scan does not recover agents or query users", async () => {
  let releaseScan;
  const pendingScan = new Promise(resolve => { releaseScan = resolve; });
  const handlers = {};
  const events = {
    scans: 0, updates: 0, audits: 0, userReads: 0,
    runs: 0, disconnects: 0, exits: [], errors: []
  };
  const prisma = {
    user: {
      async findMany() {
        events.userReads += 1;
        return [{ id: "staging-user" }];
      }
    },
    agent: {
      async findMany({ where }) {
        if (where.status !== "RUNNING") throw new Error("unexpected due-agent scan");
        events.scans += 1;
        await pendingScan;
        return [{ id: "stale-agent" }];
      },
      async updateMany() {
        events.updates += 1;
        throw new Error("must not recover stale agents after SIGTERM");
      }
    },
    agentRun: {
      async updateMany() {
        events.audits += 1;
        throw new Error("must not update stale audits after SIGTERM");
      }
    },
    async $disconnect() { events.disconnects += 1; }
  };
  const dependencies = {
    dotenv: { config() {} },
    "./lib/prisma": prisma,
    "./core/agents/AgentRunner": class {
      async run() { events.runs += 1; }
    },
    "./api/services/AgentService": class {
      async ensureDefaults() { throw new Error("unexpected provisioning"); }
    }
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
  assert.equal(events.scans, 1, "stale scan must be in flight");
  assert.equal(typeof handlers.SIGTERM, "function");

  const shutdown = handlers.SIGTERM();
  assert.equal(events.disconnects, 0, "wait for the scan before disconnecting");
  releaseScan();
  await shutdown;

  assert.equal(events.updates, 0, "do not recover stale agents after shutdown starts");
  assert.equal(events.audits, 0);
  assert.equal(events.userReads, 0, "do not start user lookup during shutdown");
  assert.equal(events.runs, 0);
  assert.equal(events.disconnects, 1);
  assert.deepEqual(events.exits, [0]);
  assert.equal(events.errors.length, 0);
});
