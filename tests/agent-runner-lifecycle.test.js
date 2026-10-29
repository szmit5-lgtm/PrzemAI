"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Module = require("node:module");
const path = require("node:path");

const runnerPath = path.resolve(__dirname, "../core/agents/AgentRunner.js");

function setup(runFinancial, options = {}) {
  const calls = { created: [], audited: [], states: [], financial: [] };
  const prisma = {
    agentRun: {
      async create(args) {
        calls.created.push(args);
        if (options.createError) throw options.createError;
        return { id: "run-test-1" };
      },
      async update(args) {
        calls.audited.push(args);
        return args;
      }
    },
    agent: {
      async updateMany(args) {
        calls.states.push(args);
        return { count: 1 };
      }
    }
  };
  class FakeFinancialAgent {
    async run(args) {
      calls.financial.push(args);
      return runFinancial(args);
    }
  }

  const originalLoad = Module._load;
  Module._load = function (request, parent, isMain) {
    if (parent?.filename === runnerPath && request === "../../lib/prisma") return prisma;
    if (parent?.filename === runnerPath && request === "../../agents/financial/FinancialAgent") return FakeFinancialAgent;
    return originalLoad.call(this, request, parent, isMain);
  };

  let AgentRunner;
  try {
    delete require.cache[runnerPath];
    AgentRunner = require(runnerPath);
  } finally {
    Module._load = originalLoad;
  }
  return { runner: new AgentRunner(), calls };
}

const agent = { id: "agent-test-1", userId: "user-test-1", type: "FINANCIAL", intervalMinutes: 30 };

test("successful agent run records audit and schedules next run", async () => {
  const { runner, calls } = setup(async () => ({ summary: "ok", metadata: { processed: 2 } }));
  const result = await runner.run(agent, "SCHEDULE");
  assert.equal(result.summary, "ok");
  assert.deepEqual(calls.created[0].data, { agentId: agent.id, status: "RUNNING", trigger: "SCHEDULE" });
  assert.deepEqual(calls.financial, [{ userId: agent.userId }]);
  assert.equal(calls.audited[0].data.status, "SUCCESS");
  assert.equal(calls.audited[0].data.metadata.processed, 2);
  assert.deepEqual(calls.states[0].where, { id: agent.id, status: "RUNNING" });
  assert.equal(calls.states[0].data.status, "IDLE");
  assert.equal(calls.states[0].data.nextRunAt - calls.states[0].data.lastRunAt, 30 * 60 * 1000);
});

test("failed agent run records failure and delays retry by at least five minutes", async () => {
  const { runner, calls } = setup(async () => { throw new Error("simulated integration failure"); });
  const before = Date.now();
  await assert.rejects(runner.run({ ...agent, intervalMinutes: 1 }), /simulated integration failure/);
  assert.equal(calls.audited[0].data.status, "FAILED");
  assert.equal(calls.audited[0].data.error, "simulated integration failure");
  assert.equal(calls.states[0].data.status, "ERROR");
  assert.deepEqual(calls.states[0].where, { id: agent.id, status: "RUNNING" });
  assert.ok(calls.states[0].data.nextRunAt.getTime() >= before + 5 * 60 * 1000);
  assert.ok(calls.states[0].data.nextRunAt.getTime() <= Date.now() + 5 * 60 * 1000);
});


test("invalid interval on success falls back to fifteen minutes", async () => {
  const { runner, calls } = setup(async () => ({ summary: "ok" }));
  await runner.run({ ...agent, intervalMinutes: 0 });
  assert.equal(calls.audited[0].data.status, "SUCCESS");
  assert.equal(calls.states[0].data.status, "IDLE");
  assert.equal(
    calls.states[0].data.nextRunAt.getTime() - calls.states[0].data.lastRunAt.getTime(),
    15 * 60 * 1000
  );
});

test("negative interval on failure cannot cause an immediate retry", async () => {
  const { runner, calls } = setup(async () => { throw new Error("simulated invalid schedule"); });
  const before = Date.now();
  await assert.rejects(
    runner.run({ ...agent, intervalMinutes: -10 }),
    /simulated invalid schedule/
  );
  assert.equal(calls.audited[0].data.status, "FAILED");
  assert.equal(calls.states[0].data.status, "ERROR");
  assert.ok(calls.states[0].data.nextRunAt.getTime() >= before + 15 * 60 * 1000);
  assert.ok(calls.states[0].data.nextRunAt.getTime() <= Date.now() + 15 * 60 * 1000);
});

test("extremely large interval on success cannot create an invalid next-run date", async () => {
  const { runner, calls } = setup(async () => ({ summary: "ok" }));
  await runner.run({ ...agent, intervalMinutes: Number.MAX_SAFE_INTEGER });
  assert.equal(calls.audited[0].data.status, "SUCCESS");
  assert.equal(calls.states[0].data.status, "IDLE");
  assert.equal(
    calls.states[0].data.nextRunAt.getTime() - calls.states[0].data.lastRunAt.getTime(),
    15 * 60 * 1000
  );
});

test("fractional interval on failure falls back to a safe retry time", async () => {
  const { runner, calls } = setup(async () => { throw new Error("simulated failure"); });
  const before = Date.now();
  await assert.rejects(
    runner.run({ ...agent, intervalMinutes: 0.5 }),
    /simulated failure/
  );
  assert.equal(calls.states[0].data.status, "ERROR");
  assert.ok(calls.states[0].data.nextRunAt.getTime() >= before + 15 * 60 * 1000);
  assert.ok(calls.states[0].data.nextRunAt.getTime() <= Date.now() + 15 * 60 * 1000);
});

test("unsupported agent type fails closed without invoking financial integration", async () => {
  const { runner, calls } = setup(async () => { throw new Error("must not run"); });
  await assert.rejects(runner.run({ ...agent, type: "UNKNOWN" }), /Nieobsługiwany typ agenta/);
  assert.equal(calls.financial.length, 0);
  assert.equal(calls.audited[0].data.status, "FAILED");
  assert.equal(calls.states[0].data.status, "ERROR");
});

test("audit creation failure releases RUNNING claim without invoking integration", async () => {
  const { runner, calls } = setup(async () => { throw new Error("must not run"); }, {
    createError: new Error("audit storage unavailable")
  });
  const before = Date.now();
  await assert.rejects(runner.run(agent), /audit storage unavailable/);
  assert.equal(calls.created.length, 1);
  assert.equal(calls.audited.length, 0);
  assert.equal(calls.financial.length, 0);
  assert.equal(calls.states.length, 1);
  assert.deepEqual(calls.states[0].where, { id: agent.id, status: "RUNNING" });
  assert.equal(calls.states[0].data.status, "ERROR");
  assert.ok(calls.states[0].data.nextRunAt.getTime() >= before + agent.intervalMinutes * 60000);
});
