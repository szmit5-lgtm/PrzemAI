"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const script = fs.readFileSync(path.join(__dirname, "../scripts/staging-agent-readiness.js"), "utf8");

for (const queryFails of [false, true]) {
  test(`staging diagnostic handles credential-bearing disconnect failure after ${queryFails ? "query failure" : "successful queries"}`, async () => {
    const secret = "postgresql://private-user:DO_NOT_EXPOSE@private-db.example/internal";
    const stdout = [];
    const stderr = [];
    const fakeProcess = { env: {}, stdout: { write: value => stdout.push(value) }, exitCode: undefined };
    let finished;
    const loggedDisconnectFailure = new Promise(resolve => { finished = resolve; });
    const query = value => () => queryFails
      ? Promise.reject(new Error(`Query failed: ${secret}`))
      : Promise.resolve(value);
    const prisma = {
      user: { count: query(1) },
      agent: { groupBy: query([]) },
      agentRun: { groupBy: query([]), count: query(0) },
      async $disconnect() { throw new Error(`Disconnect failed: ${secret}`); }
    };

    vm.runInNewContext(script, {
      require(name) {
        if (name === "dotenv") return { config() {} };
        if (name === "../lib/prisma") return prisma;
        if (name === "../lib/stagingAgentReadiness") return {
          buildStagingReadiness() { return { safeToRunStagingWrites: false }; },
          SUPPORTED_RUNTIME_TYPES: ["FINANCIAL"]
        };
        if (name === "../lib/stagingDiagnosticGuard") return {
          stagingDiagnosticContext() { return { databaseIsolationVerified: false, railwayEnvironment: "production" }; }
        };
        throw new Error("Unexpected dependency: " + name);
      },
      process: fakeProcess,
      console: { error: (...parts) => {
        const message = parts.join(" ");
        stderr.push(message);
        if (message.includes("Database disconnect failed.")) finished();
      } }
    }, { filename: "staging-agent-readiness.js", timeout: 1000 });

    await Promise.race([
      loggedDisconnectFailure,
      new Promise((_, reject) => setTimeout(() => reject(new Error("Disconnect failure was not handled")), 1500))
    ]);
    assert.equal(fakeProcess.exitCode, 1);
    assert.match(stderr.join(" "), /\[Staging readiness\] Failed: Database disconnect failed\./);
    assert.doesNotMatch(stderr.join(" "), /DO_NOT_EXPOSE|private-user|private-db\.example/);
    assert.equal(stdout.length, queryFails ? 0 : 1);
  });
}
