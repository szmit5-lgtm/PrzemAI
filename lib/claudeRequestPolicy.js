"use strict";

function claudeMonthlyLimit(value = process.env.CLAUDE_MONTHLY_BUDGET_PLN ?? "0") {
  if (!/^\d{1,2}(?:\.\d{1,2})?$/.test(value) || Number(value) > 50)
    throw new Error("CLAUDE_MONTHLY_BUDGET_PLN must be configured between 0 and 50 PLN.");
  const [pln, grosze = ""] = value.split(".");
  return BigInt(pln) * 1000000n + BigInt(grosze.padEnd(2, "0")) * 10000n;
}

async function reserveClaude(cost, limit, db = require("./prisma")) {
  if (typeof cost !== "bigint" || cost <= 0n || typeof limit !== "bigint" ||
      limit > 50000000n || cost > limit) throw budgetExhausted();
  const reserved = await db.$queryRaw`
    INSERT INTO "OpenAIMonthlyBudget" ("month", "reservedMicroPln", "claudeReservedMicroPln")
    VALUES (date_trunc('month', CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::date, 0, ${cost}::bigint)
    ON CONFLICT ("month") DO UPDATE
      SET "claudeReservedMicroPln" = "OpenAIMonthlyBudget"."claudeReservedMicroPln" + EXCLUDED."claudeReservedMicroPln"
      WHERE "OpenAIMonthlyBudget"."claudeReservedMicroPln" <= ${limit}::bigint - EXCLUDED."claudeReservedMicroPln"
        AND "OpenAIMonthlyBudget"."reservedMicroPln" <=
          200000000 - "OpenAIMonthlyBudget"."claudeReservedMicroPln" - EXCLUDED."claudeReservedMicroPln"
    RETURNING "claudeReservedMicroPln"
  `;
  if (!reserved.length) throw budgetExhausted();
}

function budgetExhausted() {
  return Object.assign(new Error("Miesięczny budżet Claude lub wspólny budżet AI został wyczerpany."), {
    code: "AI_MONTHLY_BUDGET_LIMIT"
  });
}

// Only the fixed text-only staging diagnostic uses this reservation path.
function estimateClaudeSmoke(model, payload, priceBounds = process.env.CLAUDE_PRICE_BOUNDS_JSON, now = Date.now()) {
  const price = JSON.parse(priceBounds || "{}")[model];
  if (!price || !(Date.parse(price.validUntil) > now) ||
      ![price.input, price.output].every(value => Number.isSafeInteger(value) && value > 0))
    throw new Error("Brak aktualnej górnej granicy ceny Claude.");
  return BigInt(Buffer.byteLength(payload) + 4096) * BigInt(price.input) + 16n * BigInt(price.output);
}

module.exports = { claudeMonthlyLimit, reserveClaude, estimateClaudeSmoke };
