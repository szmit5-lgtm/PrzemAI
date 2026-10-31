"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "../worker.js"), "utf8");
const settled = () => new Promise(resolve => setImmediate(resolve));

test("SIGTERM waits for an in-flight stale-run audit before disconnecting", async () => {
  let finishAudit;
  const pendingAudit = new Promise(resolve => { finishAudit = resolve; });
  const handlers = {};
  const events = {
    recoveryWrites: 0, auditsStarted: 0, auditsFinished: 0,
    userReads: 0, dueScans: 0, runs: 0, disconnects: 0, exits: []
  };

  const prisma = {
    user: {
      async findMany() {
        events.userReads += 1;
        throw new Error("must not read users after SIGTERM");
      }
    },
    agent: {
      async findMany({ where }) {
        if (where.status === "RUNNING") return [{ id: "abandoned-agent" }];
        events.dueScans += 1;
        throw new Error("must not scan due agents after SIGTERM");
      },
      async updateMany({ where }) {
        assert.equal(where.id, "abandoned-agent");
        events.recoveryWrites += 1;
        return { count: 1 };
      }
    },
    agentRun: {
      async updateMany({ where, data }) {
        assert.equal(where.agentId, "abandoned-agent");
        assert.equal(where.status, "RUNNING");
        assert.equal(data.status, "FAILED");
        events.auditsStarted += 1;
        await pendingAudit;
        events.auditsFinished += 1;
        return { count: 1 };
      }
    },
    async $disconnect() {
      assert.equal(events.auditsFinished, 1, "audit must finish before disconnect");
      events.disconnects += 1;
    }
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
    console: { log() {}, warn() {}, error(...args) { throw new Error(args.join(" ")); } },
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
  assert.equal(events.recoveryWrites, 1);
  assert.equal(events.auditsStarted, 1);
  assert.equal(events.auditsFinished, 0);

  const shutdown = handlers.SIGTERM();
  assert.equal(events.disconnects, 0, "do not disconnect during an audit write");
  finishAudit();
  await shutdown;

  assert.equal(events.auditsFinished, 1);
  assert.equal(events.userReads, 0);
  assert.equal(events.dueScans, 0);
  assert.equal(events.runs, 0);
  assert.equal(events.disconnects, 1);
  assert.deepEqual(events.exits, [0]);
});
