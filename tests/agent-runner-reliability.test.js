"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Module = require("node:module");

let createError = null;
let executeError = null;
let updates = [];
let runUpdates = [];
let created = [];

const prisma = {
  agentRun: {
    async create({ data }) {
      if (createError) throw createError;
      created.push(data);
      return { id: "run-test" };
    },
    async update({ where, data }) {
      runUpdates.push({ where, data });
      return data;
    }
  },
  agent: {
    async updateMany({ where, data }) {
      updates.push({ where, data });
      return { count: 1 };
    }
  }
};

class FakeFinancialAgent {
  async run() {
    if (executeError) throw executeError;
    return { summary: "ok", metadata: { newDocuments: 0 } };
  }
}

const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
  const source = parent?.filename?.replaceAll("\\", "/") || "";
  if (source.endsWith("/core/agents/AgentRunner.js")) {
    if (request === "../../lib/prisma") return prisma;
    if (request === "../../agents/financial/FinancialAgent") return FakeFinancialAgent;
  }
  return originalLoad.call(this, request, parent, isMain);
};
let AgentRunner;
try {
  AgentRunner = require("../core/agents/AgentRunner");
} finally {
  Module._load = originalLoad;
}

const agent = {
  id: "agent-test",
  userId: "user-test",
  type: "FINANCIAL",
  intervalMinutes: 15
};

function reset() {
  createError = null;
  executeError = null;
  updates = [];
  runUpdates = [];
  created = [];
}

test("scheduled execution records success and releases RUNNING claim", async () => {
  reset();
  const result = await new AgentRunner().run(agent, "SCHEDULE");
  assert.equal(result.summary, "ok");
  assert.equal(created[0].trigger, "SCHEDULE");
  assert.equal(runUpdates.at(-1).data.status, "SUCCESS");
  assert.equal(updates.at(-1).where.status, "RUNNING");
  assert.equal(updates.at(-1).data.status, "IDLE");
  assert.ok(updates.at(-1).data.nextRunAt instanceof Date);
});

test("failed manual execution records failure and schedules a retry", async () => {
  reset();
  executeError = new Error("simulated mailbox failure");
  await assert.rejects(
    new AgentRunner().run(agent, "MANUAL"),
    /simulated mailbox failure/
  );
  assert.equal(created[0].trigger, "MANUAL");
  assert.equal(runUpdates.at(-1).data.status, "FAILED");
  assert.equal(updates.at(-1).where.status, "RUNNING");
  assert.equal(updates.at(-1).data.status, "ERROR");
  assert.ok(updates.at(-1).data.nextRunAt > new Date());
});

test("failed audit creation releases agent instead of leaving it RUNNING", async () => {
  reset();
  createError = new Error("simulated database audit failure");
  await assert.rejects(
    new AgentRunner().run(agent, "SCHEDULE"),
    /simulated database audit failure/
  );
  assert.equal(runUpdates.length, 0);
  assert.equal(updates.length, 1);
  assert.equal(updates[0].where.status, "RUNNING");
  assert.equal(updates[0].data.status, "ERROR");
});
