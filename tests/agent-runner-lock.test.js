"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(
  path.join(__dirname, "../core/agents/AgentRunner.js"), "utf8"
);

function harness({ releaseCount = 1, financialError = null, auditCreateError = null } = {}) {
  const events = [];
  const prisma = {
    agentRun: {
      async create({ data }) {
        if (auditCreateError) throw auditCreateError;
        events.push({ action: "createRun", data });
        return { id: "test-run" };
      },
      async update({ data }) {
        events.push({ action: "updateRun", data });
        return { id: "test-run", ...data };
      }
    },
    agent: {
      async updateMany({ data }) {
        events.push({ action: "updateAgent", data });
        return { count: releaseCount };
      }
    }
  };
  class FinancialAgent {
    async run({ userId }) {
      events.push({ action: "executeFinancial", userId });
      if (financialError) throw financialError;
      return { summary: "Test completed", metadata: { checkedMessages: 1 } };
    }
  }

  const module = { exports: {} };
  const factory = vm.runInNewContext(
    `(function (require, module) {\n${source}\n})`,
    { setInterval, clearInterval, console },
    { filename: "AgentRunner.js" }
  );
  factory(id => {
    if (id === "../../lib/prisma") return prisma;
    if (id === "../../agents/financial/FinancialAgent") return FinancialAgent;
    throw new Error("Unexpected import: " + id);
  }, module);
  return { AgentRunner: module.exports, events };
}

const agent = () => ({
  id: "test-agent",
  userId: "test-user",
  type: "FINANCIAL",
  intervalMinutes: 15
});

test("successful financial run records SUCCESS and releases the lock", async () => {
  const { AgentRunner, events } = harness();
  const result = await new AgentRunner().run(agent(), "MANUAL");
  assert.equal(result.summary, "Test completed");
  assert.equal(events.find(e => e.action === "executeFinancial").userId, "test-user");
  assert.deepEqual(
    events.filter(e => e.action === "updateRun").map(e => e.data.status),
    ["SUCCESS"]
  );
  assert.equal(events.find(e => e.action === "updateAgent").data.status, "IDLE");
});

test("lost execution lock cannot leave a false SUCCESS audit", async () => {
  const { AgentRunner, events } = harness({ releaseCount: 0 });
  await assert.rejects(
    new AgentRunner().run(agent(), "SCHEDULE"),
    /lost ownership before completion/
  );
  assert.deepEqual(
    events.filter(e => e.action === "updateRun").map(e => e.data.status),
    ["SUCCESS", "FAILED"]
  );
  // Reclaim may already have started a new RUNNING execution. Never
  // overwrite that newer owner with ERROR after our release loses the lock.
  assert.equal(events.filter(e => e.action === "updateAgent").length, 1);
  assert.equal(events.find(e => e.action === "updateAgent").data.status, "IDLE");
});

test("financial execution error records FAILED and schedules retry", async () => {
  const { AgentRunner, events } = harness({ financialError: new Error("test failure") });
  await assert.rejects(new AgentRunner().run(agent()), /test failure/);
  assert.deepEqual(
    events.filter(e => e.action === "updateRun").map(e => e.data.status),
    ["FAILED"]
  );
  assert.equal(events.at(-1).data.status, "ERROR");
});

test("unsupported agent type is rejected rather than marked successful", async () => {
  const { AgentRunner, events } = harness();
  await assert.rejects(
    new AgentRunner().run({ ...agent(), type: "EXECUTIVE" }),
    /Nieobsługiwany typ agenta/
  );
  assert.equal(events.some(e => e.action === "executeFinancial"), false);
  assert.deepEqual(
    events.filter(e => e.action === "updateRun").map(e => e.data.status),
    ["FAILED"]
  );
});

test("audit creation failure releases the RUNNING claim", async () => {
  const { AgentRunner, events } = harness({
    auditCreateError: new Error("audit storage unavailable")
  });
  await assert.rejects(new AgentRunner().run(agent()), /audit storage unavailable/);
  assert.equal(events.some(e => e.action === "executeFinancial"), false);
  assert.equal(events.some(e => e.action === "updateRun"), false);
  const unlocks = events.filter(e => e.action === "updateAgent");
  assert.equal(unlocks.length, 1);
  assert.equal(unlocks[0].data.status, "ERROR");
  assert.ok(Number.isFinite(unlocks[0].data.nextRunAt.getTime()));
});
