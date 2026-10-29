"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const workerSource = fs.readFileSync(path.join(__dirname, "../worker.js"), "utf8");

// Exercise the real worker entrypoint with in-memory dependencies. Never
// connect to Railway, Prisma, or external integrations during these tests.
function startWorker(overrides = {}) {
  const events = { logs: [], warnings: [], errors: [], runs: [], ensured: [], tick: null };
  const prisma = {
    user: { findMany: async () => [] },
    agent: {
      findMany: async () => [],
      updateMany: async () => ({ count: 1 })
    },
    agentRun: { updateMany: async () => ({ count: 0 }) },
    $disconnect: async () => {},
    ...overrides.prisma
  };

  class AgentRunner {
    async run(agent, trigger) {
      events.runs.push({ agent, trigger });
      if (overrides.run) return overrides.run(agent, trigger);
    }
  }
  class AgentService {
    async ensureDefaults(userId) {
      events.ensured.push(userId);
      if (overrides.ensureDefaults) return overrides.ensureDefaults(userId);
    }
  }

  const dependencies = {
    dotenv: { config() {} },
    "./lib/prisma": prisma,
    "./core/agents/AgentRunner": AgentRunner,
    "./api/services/AgentService": AgentService
  };

  vm.runInNewContext(workerSource, {
    require(name) {
      if (!Object.hasOwn(dependencies, name)) throw new Error("Unexpected dependency: " + name);
      return dependencies[name];
    },
    console: {
      log: (...args) => events.logs.push(args),
      warn: (...args) => events.warnings.push(args),
      error: (...args) => events.errors.push(args)
    },
    process: { env: {}, on() {}, exit() { throw new Error("Unexpected exit"); } },
    Date,
    setInterval(callback) { events.tick = callback; return 1; },
    clearInterval() {},
    setTimeout
  }, { filename: "worker.js" });

  assert.equal(typeof events.tick, "function");
  return events;
}

const settled = () => new Promise(resolve => setImmediate(resolve));

test("worker warns once when no users are provisioned and schedules no runs", async () => {
  const events = startWorker();

  await settled();
  assert.equal(events.ensured.length, 0);
  assert.equal(events.runs.length, 0);
  assert.equal(events.warnings.length, 1);
  assert.match(events.warnings[0][0], /No users in this database/);

  // A repeated cycle must not flood logs or manufacture successful work.
  events.tick();
  await settled();
  assert.equal(events.ensured.length, 0);
  assert.equal(events.runs.length, 0);
  assert.equal(events.warnings.length, 1);
});

test("worker claims only due agents that remain available at update time", async () => {
  const claims = [];
  const due = [
    { id: "agent-a", key: "first", userId: "user-1", enabled: true },
    { id: "agent-b", key: "second", userId: "user-1", enabled: true }
  ];
  const events = startWorker({
    prisma: {
      user: { findMany: async () => [{ id: "user-1" }] },
      agent: {
        findMany: async ({ where }) => where.status === "RUNNING" ? [] : due,
        updateMany: async args => {
          claims.push(args);
          return { count: args.where.id === "agent-a" ? 1 : 0 };
        }
      }
    }
  });

  await settled();
  assert.deepEqual(events.ensured, ["user-1"]);
  assert.equal(claims.length, 2);
  assert.equal(claims[0].where.enabled, true);
  assert.equal(claims[0].where.NOT.status, "RUNNING");
  assert.equal(claims[0].where.OR[0].nextRunAt, null);
  assert.ok(claims[0].where.OR[1].nextRunAt.lte instanceof Date);
  assert.equal(claims[0].data.status, "RUNNING");
  assert.equal(events.runs.length, 1);
  assert.equal(events.runs[0].agent.id, "agent-a");
  assert.equal(events.runs[0].trigger, "SCHEDULE");
});

test("worker recovers a stale RUNNING claim and marks its audit as failed", async () => {
  const claims = [];
  const audits = [];
  const events = startWorker({
    prisma: {
      agent: {
        findMany: async ({ where }) => where.status === "RUNNING"
          ? [{ id: "stale-agent" }] : [],
        updateMany: async args => {
          claims.push(args);
          return { count: 1 };
        }
      },
      agentRun: {
        updateMany: async args => {
          audits.push(args);
          return { count: 1 };
        }
      }
    }
  });

  await settled();
  assert.equal(claims.length, 1);
  assert.equal(claims[0].where.id, "stale-agent");
  assert.equal(claims[0].where.status, "RUNNING");
  assert.ok(claims[0].where.updatedAt.lt instanceof Date);
  assert.equal(claims[0].data.status, "ERROR");
  assert.ok(claims[0].data.nextRunAt instanceof Date);
  assert.equal(audits.length, 1);
  assert.equal(audits[0].where.agentId, "stale-agent");
  assert.equal(audits[0].where.status, "RUNNING");
  assert.equal(audits[0].data.status, "FAILED");
  assert.ok(audits[0].data.finishedAt instanceof Date);
  assert.equal(events.runs.length, 0);
});

test("worker skips overlapping timer ticks while an earlier cycle is active", async () => {
  let releaseFirstRead;
  const firstRead = new Promise(resolve => { releaseFirstRead = resolve; });
  let userReads = 0;
  const events = startWorker({
    prisma: {
      user: {
        async findMany() {
          userReads += 1;
          if (userReads === 1) await firstRead;
          return [];
        }
      }
    }
  });

  await settled();
  assert.equal(userReads, 1);
  events.tick();
  await settled();
  assert.equal(userReads, 1, "overlapping tick must not start another cycle");

  releaseFirstRead();
  await settled();
  assert.equal(events.logs.filter(entry => entry[0] === "[Worker] Cycle").length, 1);

  events.tick();
  await settled();
  assert.equal(userReads, 2, "next tick can run after the previous cycle completes");
  assert.equal(events.errors.length, 0);
});

test("worker continues other users and due agents when one user's provisioning fails", async () => {
  const dueAgent = { id: "healthy-agent", key: "healthy", userId: "user-2", enabled: true };
  const events = startWorker({
    prisma: {
      user: { findMany: async () => [{ id: "user-1" }, { id: "user-2" }] },
      agent: {
        findMany: async ({ where }) => where.status === "RUNNING" ? [] : [dueAgent],
        updateMany: async () => ({ count: 1 })
      }
    },
    ensureDefaults: async userId => {
      if (userId === "user-1") throw new Error("simulated provisioning error");
    }
  });

  await settled();
  assert.deepEqual(events.ensured, ["user-1", "user-2"]);
  assert.equal(events.errors.length, 1);
  assert.match(events.errors[0][0], /Failed to ensure default agents/);
  assert.equal(events.runs.length, 1);
  assert.equal(events.runs[0].agent.id, "healthy-agent");
  assert.equal(events.runs[0].trigger, "SCHEDULE");
});

test("worker continues running other due agents after one agent fails", async () => {
  const due = [
    { id: "broken-agent", key: "broken", userId: "user-1", enabled: true },
    { id: "healthy-agent", key: "healthy", userId: "user-1", enabled: true }
  ];
  const events = startWorker({
    prisma: {
      user: { findMany: async () => [{ id: "user-1" }] },
      agent: {
        findMany: async ({ where }) => where.status === "RUNNING" ? [] : due,
        updateMany: async () => ({ count: 1 })
      }
    },
    run: async agent => {
      if (agent.id === "broken-agent") throw new Error("simulated integration failure");
    }
  });

  await settled();
  assert.deepEqual(events.runs.map(({ agent }) => agent.id), ["broken-agent", "healthy-agent"]);
  assert.equal(events.errors.length, 1);
  assert.match(events.errors[0][0], /Agent failed/);
  assert.equal(events.errors[0][1], "broken");
  const cycle = events.logs.find(entry => entry[0] === "[Worker] Cycle");
  assert.ok(cycle, "worker must log its first cycle");
  const summary = JSON.parse(cycle[1]);
  assert.equal(summary.completed, 1);
  assert.equal(summary.failed, 1);
  assert.equal(summary.due, 2);
});
