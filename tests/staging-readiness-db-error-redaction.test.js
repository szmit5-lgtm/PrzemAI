"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const script = fs.readFileSync(path.join(__dirname, "../scripts/staging-agent-readiness.js"), "utf8");

for (const failingQuery of ["user.count", "agentRun.count"]) {
  test(`staging diagnostic redacts credentials on ${failingQuery} database failure`, async () => {
    const secret = "postgresql://private-user:DO_NOT_EXPOSE@private-db.example/internal";
    const stdout = [];
    const stderr = [];
    let disconnect;
    const disconnected = new Promise(resolve => { disconnect = resolve; });
    const fakeProcess = { env: {}, stdout: { write: value => stdout.push(value) }, exitCode: undefined };
    const query = (name, result) => () => name === failingQuery
      ? Promise.reject(new Error(`Query failed: ${secret}`))
      : Promise.resolve(result);
    const prisma = {
      user: { count: query("user.count", 1) },
      agent: { groupBy: query("agent.groupBy", []) },
      agentRun: {
        groupBy: query("agentRun.groupBy", []),
        count: query("agentRun.count", 0)
      },
      async $disconnect() { disconnect(); }
    };

    vm.runInNewContext(script, {
      require(name) {
        if (name === "dotenv") return { config() {} };
        if (name === "../lib/prisma") return prisma;
        if (name === "../lib/stagingAgentReadiness") return {
          buildStagingReadiness() { throw new Error("must not run after database failure"); },
          SUPPORTED_RUNTIME_TYPES: ["FINANCIAL"]
        };
        if (name === "../lib/stagingDiagnosticGuard") return {
          stagingDiagnosticContext() { return { databaseIsolationVerified: false, railwayEnvironment: "production" }; }
        };
        throw new Error("Unexpected dependency: " + name);
      },
      process: fakeProcess,
      console: { error: (...parts) => stderr.push(parts.join(" ")) }
    }, { filename: "staging-agent-readiness.js", timeout: 1000 });

    await Promise.race([
      disconnected,
      new Promise((_, reject) => setTimeout(() => reject(new Error("Diagnostic did not disconnect")), 1500))
    ]);
    assert.equal(fakeProcess.exitCode, 1);
    assert.deepEqual(stdout, []);
    assert.match(stderr.join(" "), /\[Staging readiness\] Failed: Diagnostic failed/);
    assert.doesNotMatch(stderr.join(" "), /DO_NOT_EXPOSE|private-user|private-db\.example/);
  });
}
