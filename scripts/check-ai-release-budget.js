"use strict";

// Read-only, with no call to OpenAI. Run from the candidate's API and worker
// environments after validating the database identity and deploying the schema.
const { dailyLimit, monthlyLimit, estimateRequest } = require("../lib/openAIRequestPolicy");

async function checkBudget(db, env = process.env) {
  const requireSetting = name => {
    if (!env[name]?.trim()) throw new Error("MISSING_" + name);
    return env[name];
  };
  requireSetting("OPENAI_API_KEY");
  const daily = dailyLimit(requireSetting("OPENAI_DAILY_REQUEST_LIMIT"));
  const monthly = monthlyLimit(requireSetting("OPENAI_MONTHLY_BUDGET_PLN"));
  const prices = requireSetting("OPENAI_PRICE_BOUNDS_JSON");
  const cost = estimateRequest("https://api.openai.com/v1/responses", {
    method: "POST",
    body: JSON.stringify({
      model: "gpt-5.5", max_output_tokens: 1000,
      input: [
        { role: "system", content: [{ type: "input_text", text: "Próba gotowości General Agent" }] },
        { role: "user", content: [{ type: "input_text", text: "Dane syntetyczne. ".repeat(256) }] }
      ]
    })
  }, prices);
  const [usage] = await db.$queryRaw`
    SELECT
      COALESCE((SELECT "requests" FROM "OpenAIRequestBudget"
        WHERE "day" = (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::date), 0) AS "daily",
      COALESCE((SELECT "reservedMicroPln" FROM "OpenAIMonthlyBudget"
        WHERE "month" = date_trunc('month', CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::date), 0) AS "monthly"
  `;
  if (daily - Number(usage.daily) < 3) throw new Error("AI_DAILY_HEADROOM");
  if (monthly - BigInt(usage.monthly) < 3n * cost) throw new Error("AI_MONTHLY_HEADROOM");
}

if (require.main === module) {
  const db = require("../lib/prisma");
  checkBudget(db).then(() => {
    console.log("AI_BUDGET_READY_FOR_SYNTHETIC_THREE_PART_PLAN");
  }).catch(error => {
    const safe = /^(?:MISSING_OPENAI_(?:API_KEY|DAILY_REQUEST_LIMIT|MONTHLY_BUDGET_PLN|PRICE_BOUNDS_JSON)|AI_(?:DAILY|MONTHLY)_HEADROOM)$/;
    console.error(safe.test(error.message) ? error.message :
      error.code === "AI_PRICE_UNAVAILABLE" ? "AI_PRICE_UNAVAILABLE" : "AI_BUDGET_CHECK_FAILED");
    process.exitCode = 1;
  }).finally(() => db.$disconnect());
}

module.exports = { checkBudget };
