"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { buildStagingReadiness } = require("../lib/stagingAgentReadiness");
const { stagingDiagnosticContext } = require("../lib/stagingDiagnosticGuard");

const script = fs.readFileSync(path.join(__dirname, "../scripts/staging-agent-readiness.js"), "utf8");

const stagingEnv = {
  RAILWAY_PROJECT_ID: "8b898b94-7bca-4a34-af28-8f114d776825",
  RAILWAY_ENVIRONMENT_ID: "93d636bd-faba-4a8e-8522-b7b75be2de6c",
  RAILWAY_ENVIRONMENT_NAME: "production",
  RAILWAY_SERVICE_ID: "e0760856-81ba-48d9-898d-953b976ca5b1",
  RAILWAY_SERVICE_NAME: "PrzemAI-worker-staging"
};

async function executeDiagnostic({ env, users = 0, agents = [], runs = [], successes = 0 }) {
  const queries = [];
  const stdout = [];
  const stderr = [];
  let resolveDisconnect;
  const disconnected = new Promise(resolve => { resolveDisconnect = resolve; });

  // Any unexpected Prisma operation, including a future create/update/delete,
  // fails the test instead of silently allowing a staging database write.
  function readOnlyModel(name, methods) {
    return new Proxy(methods, {
      get(target, method) {
        if (!Object.hasOwn(target, method)) {
          throw new Error("Unexpected Prisma operation: " + name + "." + String(method));
        }
        return target[method];
      }
    });
  }

  const prisma = {
    user: readOnlyModel("user", {
      async count() { queries.push("user.count"); return users; }
    }),
    agent: readOnlyModel("agent", {
      async groupBy() { queries.push("agent.groupBy"); return agents; }
    }),
    agentRun: readOnlyModel("agentRun", {
      async groupBy() { queries.push("agentRun.groupBy"); return runs; },
      async count(args) {
        queries.push("agentRun.count");
        assert.equal(args.where.status, "SUCCESS");
        assert.deepEqual([...args.where.agent.type.in], ["FINANCIAL"]);
        return successes;
      }
    }),
    async $disconnect() {
      queries.push("$disconnect");
      resolveDisconnect();
    }
  };

  const fakeProcess = {
    env,
    stdout: { write(value) { stdout.push(value); } },
    exitCode: undefined
  };

  vm.runInNewContext(script, {
    require(name) {
      if (name === "dotenv") return { config() {} };
      if (name === "../lib/prisma") return prisma;
      if (name === "../lib/stagingAgentReadiness") {
        return { buildStagingReadiness, SUPPORTED_RUNTIME_TYPES: ["FINANCIAL"] };
      }
      if (name === "../lib/stagingDiagnosticGuard") return { stagingDiagnosticContext };
      throw new Error("Unexpected dependency: " + name);
    },
    process: fakeProcess,
    console: { error(...parts) { stderr.push(parts.join(" ")); } }
  }, { filename: "staging-agent-readiness.js", timeout: 1000 });

  await Promise.race([
    disconnected,
    new Promise((_, reject) => setTimeout(() => reject(new Error("Diagnostic did not disconnect")), 1500))
  ]);
  return { queries, stdout, stderr, exitCode: fakeProcess.exitCode };
}

test("staging diagnostic reads counts only and never authorizes writes without database isolation", async () => {
  const result = await executeDiagnostic({
    env: { ...stagingEnv, SECRET_TOKEN: "DO_NOT_LOG_THIS_TOKEN" },
    users: 1,
    agents: [{ type: "FINANCIAL", status: "IDLE", enabled: true, _count: { _all: 1 } }],
    runs: [{ status: "SUCCESS", _count: { _all: 1 } }],
    successes: 1
  });
  assert.deepEqual(result.queries, [
    "user.count", "agent.groupBy", "agentRun.groupBy", "agentRun.count", "$disconnect"
  ]);
  assert.equal(result.exitCode, 2);
  assert.equal(result.stderr.length, 0);
  const report = JSON.parse(result.stdout.join(""));
  assert.equal(report.readyForScheduledTests, true);
  assert.equal(report.hasSuccessfulAgentRun, true);
  assert.equal(report.databaseIsolationVerified, false);
  assert.equal(report.safeToRunStagingWrites, false);
  assert.deepEqual(report.blockers, ["DATABASE_ISOLATION_UNVERIFIED"]);
  assert.doesNotMatch(result.stdout.join(""), /DO_NOT_LOG_THIS_TOKEN/);
});

test("production service is rejected before any database query", async () => {
  const result = await executeDiagnostic({
    env: { ...stagingEnv, RAILWAY_SERVICE_NAME: "PrzemAI", RAILWAY_SERVICE_ID: "8473a177-7172-4eb1-9d6f-96fe1df3f73d" }
  });
  assert.deepEqual(result.queries, ["$disconnect"]);
  assert.equal(result.exitCode, 1);
  assert.equal(result.stdout.length, 0);
  assert.match(result.stderr.join(" "), /restricted to the verified PrzemAI staging services/);
});

test("empty staging reports blockers without performing writes", async () => {
  const result = await executeDiagnostic({ env: stagingEnv });
  assert.equal(result.exitCode, 2);
  assert.deepEqual(JSON.parse(result.stdout.join("")).blockers, [
    "NO_STAGING_USERS", "NO_ENABLED_SUPPORTED_AGENT", "DATABASE_ISOLATION_UNVERIFIED"
  ]);
  assert.deepEqual(result.queries, [
    "user.count", "agent.groupBy", "agentRun.groupBy", "agentRun.count", "$disconnect"
  ]);
});
