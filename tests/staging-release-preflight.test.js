"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { check } = require("../scripts/check-staging-isolation");
const { probe, SCHEMA_QUERY } = require("../scripts/staging-schema-probe");

const staging = {
  RAILWAY_PROJECT_ID: "8b898b94-7bca-4a34-af28-8f114d776825",
  RAILWAY_ENVIRONMENT_ID: "64404202-9c65-4076-a917-111e6448281a",
  RAILWAY_ENVIRONMENT_NAME: "staging",
  RAILWAY_SERVICE_ID: "1f155ed3-d2b7-4d65-b476-c040d02d8fa6",
  DATABASE_URL: "postgresql://fixture:fixture@postgres-vycl.railway.internal:5432/railway",
  KSEF_SYNC_ENABLED: "false",
  KSEF_DEHERUS_SYNC_ENABLED: "false",
  CLAUDE_DEV_ENABLED: "false",
  WHATSAPP_SEND_ENABLED: "false"
};

test("isolated staging excludes database overrides and live Telegram credentials", () => {
  assert.equal(check({ ...staging, DATABASE_URL: staging.DATABASE_URL + "?schema=public" }).ok, true);
  for (const suffix of ["?host=postgres.railway.internal", "?schema=other",
    "?schema=public&schema=public", "#fragment"]) {
    assert.throws(() => check({ ...staging, DATABASE_URL: staging.DATABASE_URL + suffix }), /STAGING_ISOLATION_UNVERIFIED/);
  }
  for (const overrides of [
    { RAILWAY_ENVIRONMENT_NAME: "production" }, { RAILWAY_SERVICE_ID: "production" },
    { DATABASE_URL: staging.DATABASE_URL.replace(":5432", ":5433") },
    { DATABASE_URL: staging.DATABASE_URL.replace("/railway", "/other") },
    { TELEGRAM_TOKEN: "fixture" }, { TELEGRAM_WEBHOOK_SECRET: "fixture" },
    { TELEGRAM_NOTIFICATIONS_ENABLED: "true" }
  ]) {
    assert.throws(() => check({ ...staging, ...overrides }), /STAGING_ISOLATION_UNVERIFIED/);
  }
});

test("schema probe stops before querying an unverified endpoint", async () => {
  const db = { $queryRawUnsafe() { assert.fail("Query attempted"); } };
  await assert.rejects(probe({ env: {}, db }), /STAGING_ISOLATION_UNVERIFIED/);
});

test("schema probe distinguishes a missing P0 column from a complete schema", async () => {
  const keys = ["whatsapp", "bankAccount", "bankStatement", "bankTransaction", "migrations",
    "investmentAssignees", "dailyAiBudget", "monthlyAiBudget", "chatChannel",
    "investmentScoped", "taskSetNull", "documentSetNull"];
  const db = {
    async $queryRawUnsafe(query) {
      assert.equal(query, SCHEMA_QUERY);
      return [Object.fromEntries(keys.map(key => [key, key !== "investmentScoped"]))];
    }
  };
  const logs = [];
  const result = await probe({ env: staging, db, log: { log: message => logs.push(message) } });
  assert.equal(result.investmentScoped, false);
  assert.equal(result.documentSetNull, true);
  assert.match(logs[0], /investmentScoped=absent/);
});
