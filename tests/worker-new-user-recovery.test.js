"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "../worker.js"), "utf8");
const settled = () => new Promise(resolve => setImmediate(resolve));

test("worker begins scheduling a newly provisioned user after an empty staging cycle", async () => {
  const user = { id: "new-staging-user" };
  const agent = { id: "new-agent", key: "general", userId: user.id, enabled: true };
  let users = [];
  let defaultsCreated = false;
  let tick;
  const events = { defaults: [], runs: [], warnings: [], cycles: [] };
  const prisma = {
    user: { async findMany() { return users; } },
    agent: {
      async findMany({ where }) {
        if (where.status === "RUNNING") return [];
        return defaultsCreated ? [agent] : [];
      },
      async updateMany() { return { count: 1 }; }
    },
    agentRun: { async updateMany() { return { count: 0 }; } },
    async $disconnect() {}
  };
  const dependencies = {
    dotenv: { config() {} },
    "./lib/prisma": prisma,
    "./core/agents/AgentRunner": class {
      async run(item, trigger) { events.runs.push([item.id, trigger]); }
    },
    "./api/services/AgentService": class {
      async ensureDefaults(userId) {
        events.defaults.push(userId);
        defaultsCreated = true;
      }
    }
  };

  vm.runInNewContext(source, {
    require(name) {
      if (!Object.hasOwn(dependencies, name)) throw new Error("Unexpected dependency: " + name);
      return dependencies[name];
    },
    console: {
      log(...args) { if (args[0] === "[Worker] Cycle") events.cycles.push(JSON.parse(args[1])); },
      warn(...args) { events.warnings.push(args[0]); },
      error(...args) { throw new Error("Unexpected worker error: " + args[0]); }
    },
    process: { env: {}, on() {}, exit() {} },
    Date,
    setInterval(callback) { tick = callback; return 1; },
    clearInterval() {},
    setTimeout
  }, { filename: "worker.js" });

  await settled();
  assert.deepEqual(events.defaults, []);
  assert.deepEqual(events.runs, []);
  assert.equal(events.cycles[0].users, 0);
  assert.equal(events.cycles[0].completed, 0);
  assert.equal(events.warnings.filter(msg => msg.includes("No users in this database")).length, 1);

  users = [user];
  await tick();
  assert.deepEqual(events.defaults, [user.id]);
  assert.deepEqual(events.runs, [[agent.id, "SCHEDULE"]]);
  assert.equal(events.warnings.filter(msg => msg.includes("No users in this database")).length, 1);
});
