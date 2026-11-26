"use strict";

const DEFAULT_DAILY_LIMIT = 250;

function dailyLimit(value = process.env.OPENAI_DAILY_REQUEST_LIMIT) {
  if (value === undefined) return DEFAULT_DAILY_LIMIT;
  if (!/^\d{1,5}$/.test(value) || Number(value) > 10000) {
    throw new Error("OPENAI_DAILY_REQUEST_LIMIT must be an integer between 0 and 10000.");
  }
  return Number(value);
}

async function reserveRequest(db, limit) {
  if (limit === 0) return false;
  // The database clock and atomic upsert make the limit common to every
  // replica, including concurrent workers and processes restarted mid-day.
  const rows = await db.$queryRaw`
    INSERT INTO "OpenAIRequestBudget" ("day", "requests")
    VALUES ((CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::date, 1)
    ON CONFLICT ("day") DO UPDATE
      SET "requests" = "OpenAIRequestBudget"."requests" + 1
      WHERE "OpenAIRequestBudget"."requests" < ${limit}
    RETURNING "requests"
  `;
  return rows.length === 1;
}

function openAIRequestPolicy({ db, fetchRequest = globalThis.fetch, limit = dailyLimit } = {}) {
  return {
    maxRetries: 0,
    timeout: 30000,
    async fetch(...args) {
      if (!await reserveRequest(db || require("./prisma"), limit())) {
        const error = new Error("Dzienny limit żądań AI został wyczerpany.");
        error.code = "AI_DAILY_REQUEST_LIMIT";
        throw error;
      }
      return fetchRequest(...args);
    }
  };
}

module.exports = { dailyLimit, openAIRequestPolicy };
