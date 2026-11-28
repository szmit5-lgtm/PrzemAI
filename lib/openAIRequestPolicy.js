"use strict";

const DEFAULT_DAILY_LIMIT = 250;
const MICRO_PLN = 1000000n;
const TEXT_KEYS = new Set(["model", "input", "text", "max_output_tokens"]);
const MODELS = new Set(["gpt-5.5", "gpt-6.1-sol", "gpt-6.1-terra", "gpt-6-astra", "gpt-6-luna"]);

function dailyLimit(value = process.env.OPENAI_DAILY_REQUEST_LIMIT) {
  if (value === undefined) return DEFAULT_DAILY_LIMIT;
  if (!/^\d{1,5}$/.test(value) || Number(value) > 10000) {
    throw new Error("OPENAI_DAILY_REQUEST_LIMIT must be an integer between 0 and 10000.");
  }
  return Number(value);
}

function monthlyLimit(value = process.env.OPENAI_MONTHLY_BUDGET_PLN ?? "200") {
  if (!/^\d{1,3}(?:\.\d{1,2})?$/.test(value) || Number(value) > 200)
    throw new Error("OPENAI_MONTHLY_BUDGET_PLN must be between 0 and 200.");
  const [pln, grosze = ""] = value.split(".");
  return BigInt(pln) * MICRO_PLN + BigInt(grosze.padEnd(2, "0")) * 10000n;
}

function budgetError(code, message) {
  return Object.assign(new Error(message), { code });
}

function estimateRequest(url, init, priceBounds = process.env.OPENAI_PRICE_BOUNDS_JSON, now = Date.now()) {
  const unsupported = () => budgetError("AI_UNMETERED_REQUEST", "Brak bezpiecznej wyceny tego żądania AI.");
  if (new URL(url).pathname !== "/v1/responses" || init?.method?.toUpperCase() !== "POST" ||
      typeof init.body !== "string" || Buffer.byteLength(init.body) > 270000) throw unsupported();
  const body = JSON.parse(init.body);
  if (!body || !MODELS.has(body.model) || Object.keys(body).some(key => !TEXT_KEYS.has(key)) ||
      !Number.isSafeInteger(body.max_output_tokens) || body.max_output_tokens < 1 || body.max_output_tokens > 4096 ||
      !Array.isArray(body.input) || body.input.length < 1 || body.input.length > 4 ||
      body.input.some(item => !item || Object.keys(item).some(key => !["role", "content"].includes(key)) ||
        !["system", "user"].includes(item.role) || !Array.isArray(item.content) || item.content.length !== 1 ||
        item.content.some(content => !content || content.type !== "input_text" || typeof content.text !== "string" ||
          Object.keys(content).some(key => !["type", "text"].includes(key)))) ||
      (body.text !== undefined && JSON.stringify(body.text) !== '{"format":{"type":"json_object"}}')) throw unsupported();

  // Prices are attested gross PLN ceilings (including FX and tax), in
  // micro-PLN per token. Unknown models or expired quotes stop before network I/O.
  const prices = JSON.parse(priceBounds || "{}")[body.model];
  const expires = Date.parse(prices?.validUntil);
  if (!Number.isFinite(expires) || expires <= now ||
      ![prices.input, prices.output].every(value => Number.isSafeInteger(value) && value > 0)) {
    throw budgetError("AI_PRICE_UNAVAILABLE", "Brak aktualnej górnej granicy ceny modelu AI.");
  }
  // A byte per token is an upper bound for byte-tokenized plain text.
  // Use the complete serialized body plus a conservative framing allowance.
  const inputTokens = BigInt(Buffer.byteLength(init.body) + 4096);
  return inputTokens * BigInt(prices.input) + BigInt(body.max_output_tokens) * BigInt(prices.output);
}

async function reserveRequest(db, limit, cost, ceiling) {
  return db.$transaction(async tx => {
    const daily = await tx.$queryRaw`
      INSERT INTO "OpenAIRequestBudget" ("day", "requests")
      VALUES ((CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::date, 1)
      ON CONFLICT ("day") DO UPDATE
        SET "requests" = "OpenAIRequestBudget"."requests" + 1
        WHERE "OpenAIRequestBudget"."requests" < ${limit}
      RETURNING "requests"
    `;
    if (!daily.length)
      throw budgetError("AI_DAILY_REQUEST_LIMIT", "Dzienny limit żądań AI został wyczerpany.");

    const monthly = await tx.$queryRaw`
      INSERT INTO "OpenAIMonthlyBudget" ("month", "reservedMicroPln")
      SELECT date_trunc('month', CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::date, ${cost}::bigint
      WHERE ${cost}::bigint <= ${ceiling}::bigint
      ON CONFLICT ("month") DO UPDATE
        SET "reservedMicroPln" = "OpenAIMonthlyBudget"."reservedMicroPln" + EXCLUDED."reservedMicroPln"
        WHERE "OpenAIMonthlyBudget"."reservedMicroPln" <= ${ceiling}::bigint - EXCLUDED."reservedMicroPln"
          AND "OpenAIMonthlyBudget"."reservedMicroPln" <=
            200000000 - "OpenAIMonthlyBudget"."claudeReservedMicroPln" - EXCLUDED."reservedMicroPln"
      RETURNING "reservedMicroPln"
    `;
    if (!monthly.length)
      throw budgetError("AI_MONTHLY_BUDGET_LIMIT", "Miesięczny budżet AI został wyczerpany.");
  });
}

function openAIRequestPolicy({ db, fetchRequest = globalThis.fetch, limit = dailyLimit,
  monthly = monthlyLimit, priceBounds } = {}) {
  return {
    maxRetries: 0,
    timeout: 30000,
    async fetch(url, init) {
      const daily = limit();
      if (daily === 0) throw budgetError("AI_DAILY_REQUEST_LIMIT", "Dzienny limit żądań AI został wyczerpany.");
      const ceiling = monthly();
      const cost = estimateRequest(url, init, priceBounds);
      if (cost > ceiling)
        throw budgetError("AI_MONTHLY_BUDGET_LIMIT", "Miesięczny budżet AI został wyczerpany.");
      await reserveRequest(db || require("./prisma"), daily, cost, ceiling);
      // Retain reservations after provider failures or ambiguous timeouts.
      return fetchRequest(url, init);
    }
  };
}

module.exports = { dailyLimit, monthlyLimit, estimateRequest, openAIRequestPolicy };
