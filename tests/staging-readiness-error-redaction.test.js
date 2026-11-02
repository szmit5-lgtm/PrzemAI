"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const script = fs.readFileSync(path.join(__dirname, "../scripts/staging-agent-readiness.js"), "utf8");

test("staging diagnostic fails closed without exposing connection details from thrown errors", async () => {
  const secret = "postgresql://db-user:DO_NOT_EXPOSE@db.example/internal";
  const stderr = [];
  const stdout = [];
  let disconnect;
  const disconnected = new Promise(resolve => { disconnect = resolve; });
  const fakeProcess = { env: {}, stdout: { write: value => stdout.push(value) }, exitCode: undefined };

  vm.runInNewContext(script, {
    require(name) {
      if (name === "dotenv") return { config() {} };
      if (name === "../lib/prisma") return { async $disconnect() { disconnect(); } };
      if (name === "../lib/stagingAgentReadiness") return { buildStagingReadiness() { throw new Error("must not be called"); }, SUPPORTED_RUNTIME_TYPES: ["FINANCIAL"] };
      if (name === "../lib/stagingDiagnosticGuard") return { stagingDiagnosticContext() { throw new Error(`Connection failed: ${secret}`); } };
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
  assert.match(stderr.join(" "), /\[Staging readiness\] Failed/);
  assert.doesNotMatch(stderr.join(" "), /DO_NOT_EXPOSE|db-user|db\.example/);
});
