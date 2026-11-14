"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const path = require("node:path");

const script = path.join(__dirname, "../scripts/test-anthropic.js");

function smoke(env) {
  return spawnSync(process.execPath, [script], {
    encoding: "utf8",
    timeout: 3000,
    env: {
      PATH: process.env.PATH,
      CLAUDE_DEV_ENABLED: "true",
      CLAUDE_TEST_ISOLATED: "true",
      CLAUDE_MONTHLY_BUDGET_PLN: "50",
      ANTHROPIC_API_KEY: "fake-key-not-sent",
      ...env,
    },
  });
}

test("Claude diagnostic rejects production Railway even if service name says staging", () => {
  const result = smoke({ RAILWAY_ENVIRONMENT_NAME: "production" });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Refusing paid smoke test in Railway production/);
  assert.doesNotMatch(result.stderr, /fake-key-not-sent/);
});

test("Claude diagnostic requires an explicit isolation attestation", () => {
  const result = smoke({ CLAUDE_TEST_ISOLATED: "false" });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /CLAUDE_TEST_ISOLATED=true/);
});

test("Claude diagnostic rejects unapproved monthly budget", () => {
  const result = smoke({ CLAUDE_MONTHLY_BUDGET_PLN: "51" });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /between 0 and 50 PLN/);
});

test("Claude diagnostic rejects missing budget", () => {
  const result = smoke({ CLAUDE_MONTHLY_BUDGET_PLN: "" });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /between 0 and 50 PLN/);
});
