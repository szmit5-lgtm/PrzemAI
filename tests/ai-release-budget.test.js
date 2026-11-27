"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { checkBudget } = require("../scripts/check-ai-release-budget");

test("release budget verifies a three-part plan without calling OpenAI", async () => {
  const env = {
    OPENAI_API_KEY: "synthetic",
    OPENAI_DAILY_REQUEST_LIMIT: "3",
    OPENAI_MONTHLY_BUDGET_PLN: "1",
    OPENAI_PRICE_BOUNDS_JSON: JSON.stringify({
      "gpt-5.5": { input: 1, output: 1, validUntil: new Date(Date.now() + 60000).toISOString() }
    })
  };
  const usage = { daily: 0, monthly: 0n };
  const db = { $queryRaw: async () => [usage] };
  await checkBudget(db, env);
  usage.daily = 1;
  await assert.rejects(checkBudget(db, env), /AI_DAILY_HEADROOM/);
  usage.daily = 0;
  usage.monthly = 1000000n;
  await assert.rejects(checkBudget(db, env), /AI_MONTHLY_HEADROOM/);
  await assert.rejects(checkBudget(db, { ...env, OPENAI_API_KEY: "" }), /MISSING_OPENAI_API_KEY/);
  await assert.rejects(checkBudget(db, { ...env, OPENAI_PRICE_BOUNDS_JSON: "{}" }), { code: "AI_PRICE_UNAVAILABLE" });
});
