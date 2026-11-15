"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { assessClaudeSafety } = require("../scripts/claude-safety-audit");
const safe = { RAILWAY_ENVIRONMENT_NAME: "staging", CLAUDE_DEV_ENABLED: "true",
  CLAUDE_MONTHLY_BUDGET_PLN: "50", ANTHROPIC_API_KEY: "fake-not-real",
  CLAUDE_ISOLATION_VERIFIED: "true", CLAUDE_PROVIDER_SPEND_CAP_VERIFIED: "true" };
test("refuses production even if service is called staging", () => {
  const r = assessClaudeSafety({...safe, RAILWAY_ENVIRONMENT_NAME: "production"});
  assert.equal(r.automaticApiCallAllowed, false);
  assert.ok(r.reasons.includes("environment_not_verified_staging"));
});
test("rejects malformed, excessive and zero budgets", () => {
  for(const amount of ["", "0", "50.01", "51", "Infinity", "NaN", "-1", "10abc", "10,00"])
    assert.ok(assessClaudeSafety({...safe, CLAUDE_MONTHLY_BUDGET_PLN:amount}).reasons.includes("invalid_monthly_budget"),amount);
});
test("requires attestations, key existence and opt-in", () => {
  const r=assessClaudeSafety({RAILWAY_ENVIRONMENT_NAME:"staging",CLAUDE_MONTHLY_BUDGET_PLN:"20"});
  for(const code of ["missing_api_key","claude_disabled","isolation_not_attested","provider_spend_cap_not_attested"])
    assert.ok(r.reasons.includes(code));
});
test("passing offline preflight still never authorizes an API call",()=>{
  const r=assessClaudeSafety(safe);
  assert.equal(r.eligibleForHumanReview,true);
  assert.equal(r.automaticApiCallAllowed,false);
  assert.equal(r.budgetPln,50);
});
