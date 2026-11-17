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
      RAILWAY_ENVIRONMENT_NAME: "staging",
      RAILWAY_ENVIRONMENT_ID: "64404202-9c65-4076-a917-111e6448281a",
      RAILWAY_PROJECT_ID: "8b898b94-7bca-4a34-af28-8f114d776825",
      CLAUDE_VERIFIED_REMAINING_PLN: "1",
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

test("Claude diagnostic rejects unset or fake staging identifiers", () => {
  for (const env of [
    { RAILWAY_ENVIRONMENT_NAME: "" },
    { RAILWAY_ENVIRONMENT_NAME: "staging", RAILWAY_ENVIRONMENT_ID: "other" },
    { RAILWAY_PROJECT_ID: "different-project" }
  ]) {
    const result = smoke(env);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /verified PrzemAI staging environment/);
  }
});

test("Claude diagnostic requires budget balance confirmation", () => {
  for (const balance of ["", "0", "0.01", "51", "not-a-number"]) {
    const result = smoke({ CLAUDE_VERIFIED_REMAINING_PLN: balance });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /verified remaining budget/);
  }
});

test("Claude diagnostic rejects unreviewed models before opening network", () => {
  const result = smoke({ CLAUDE_DEV_MODEL: "claude-opus-4-1" });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /only permits the reviewed low-cost model/);
});
