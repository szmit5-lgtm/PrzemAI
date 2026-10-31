"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "../worker.js"), "utf8");
const settled = () => new Promise(resolve => setImmediate(resolve));

test("SIGTERM during an in-flight due-agent scan does not claim or run agents", async () => {
  let finishScan;
  const pendingScan = new Promise(resolve => { finishScan = resolve; });
  const handlers = {};
  const events = { dueScans: 0, claims: 0, runs: 0, disconnects: 0, exits: [], errors: [] };
  const agent = { id: "due-agent", key: "financial", userId: "staging-user", enabled: true };
  const prisma = {
    user: { async findMany() { return [{ id: "staging-user" }]; } },
    agent: {
      async findMany({ where }) {
        if (where.status === "RUNNING") return [];
        events.dueScans += 1;
        await pendingScan;
        return [agent];
      },
      async updateMany() {
        events.claims += 1;
        throw new Error("must not claim agents after SIGTERM");
      }
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
      async ensureDefaults() {}
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
  assert.equal(events.dueScans, 1, "the due-agent scan must be in flight");
  assert.equal(typeof handlers.SIGTERM, "function");

  const shutdown = handlers.SIGTERM();
  assert.equal(events.disconnects, 0, "wait for the scan to finish before disconnecting");
  finishScan();
  await shutdown;

  assert.equal(events.claims, 0, "do not claim agents returned after shutdown started");
  assert.equal(events.runs, 0, "do not execute newly discovered agents");
  assert.equal(events.disconnects, 1);
  assert.deepEqual(events.exits, [0]);
  assert.equal(events.errors.length, 0);
});
