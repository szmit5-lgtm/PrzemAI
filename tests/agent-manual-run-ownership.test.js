"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Module = require("node:module");
const path = require("node:path");

const servicePath = path.resolve(__dirname, "../api/services/AgentService.js");

function setup(findFirst, updateMany) {
  const calls = { reads: [], locks: [], runs: [] };
  const prisma = {
    agent: {
      async findFirst(args) {
        calls.reads.push(args);
        return findFirst(args);
      },
      async updateMany(args) {
        calls.locks.push(args);
        return updateMany(args);
      }
    }
  };
  class FakeRunner {
    async run(agent, trigger) {
      calls.runs.push({ agent, trigger });
      return { summary: "completed" };
    }
  }

  const originalLoad = Module._load;
  Module._load = function (request, parent, isMain) {
    if (parent?.filename === servicePath && request === "../../lib/prisma") return prisma;
    if (parent?.filename === servicePath && request === "../../core/agents/AgentRunner") return FakeRunner;
    return originalLoad.call(this, request, parent, isMain);
  };

  let AgentService;
  try {
    delete require.cache[servicePath];
    AgentService = require(servicePath);
  } finally {
    Module._load = originalLoad;
  }
  return { service: new AgentService(), calls };
}

const ownedAgent = {
  id: "agent-owned",
  userId: "user-owner",
  type: "FINANCIAL",
  enabled: true,
  status: "IDLE",
  intervalMinutes: 15
};

test("manual agent run denies another user's agent before attempting a claim", async () => {
  const { service, calls } = setup(async () => null, async () => {
    throw new Error("unexpected write");
  });
  await assert.rejects(service.runNow("user-other", ownedAgent.id), /Agent nie istnieje/);
  assert.deepEqual(calls.reads[0].where, { id: ownedAgent.id, userId: "user-other" });
  assert.equal(calls.locks.length, 0);
  assert.equal(calls.runs.length, 0);
});

test("manual agent run cannot execute without winning the atomic lock", async () => {
  const { service, calls } = setup(async () => ownedAgent, async () => ({ count: 0 }));
  await assert.rejects(service.runNow("user-owner", ownedAgent.id), /wyłączony albo już działa/);
  assert.deepEqual(calls.locks[0].where, {
    id: ownedAgent.id,
    userId: "user-owner",
    enabled: true,
    NOT: { status: "RUNNING" }
  });
  assert.equal(calls.runs.length, 0);
});

test("manual agent run executes once with the owned agent after winning the lock", async () => {
  const { service, calls } = setup(async () => ownedAgent, async () => ({ count: 1 }));
  const result = await service.runNow("user-owner", ownedAgent.id);
  assert.deepEqual(result, { summary: "completed" });
  assert.equal(calls.locks.length, 1);
  assert.equal(calls.runs.length, 1);
  assert.deepEqual(calls.runs[0], {
    agent: { ...ownedAgent, status: "RUNNING" },
    trigger: "MANUAL"
  });
});
