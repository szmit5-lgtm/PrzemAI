"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { check } = require("../scripts/check-staging-isolation");

const base = Object.freeze({
  RAILWAY_PROJECT_ID: "8b898b94-7bca-4a34-af28-8f114d776825",
  RAILWAY_ENVIRONMENT_ID: "64404202-9c65-4076-a917-111e6448281a",
  RAILWAY_ENVIRONMENT_NAME: "staging",
  RAILWAY_SERVICE_ID: "1f155ed3-d2b7-4d65-b476-c040d02d8fa6",
  DATABASE_URL: "postgresql://staging:local-fixture-only@postgres-vycl.railway.internal:5432/przemai_test",
  KSEF_SYNC_ENABLED: "false",
  KSEF_DEHERUS_SYNC_ENABLED: "false",
  CLAUDE_DEV_ENABLED: "false",
  WHATSAPP_SEND_ENABLED: "false"
});

test("preflight allows only the isolated staging service and private staging DB hostname", () => {
  assert.equal(check(base).ok, true);
});

test("production environment, wrong service ID or other project fails before any DB access", () => {
  for (const patch of [
    { RAILWAY_ENVIRONMENT_NAME: "production" },
    { RAILWAY_ENVIRONMENT_ID: "93d636bd-faba-4a8e-8522-b7b75be2de6c" },
    { RAILWAY_SERVICE_ID: "8473a177-7172-4eb1-9d6f-96fe1df3f73d" },
    { RAILWAY_PROJECT_ID: "unknown" }
  ]) {
    assert.throws(() => check({ ...base, ...patch }), /STAGING_ISOLATION_UNVERIFIED/);
  }
});

test("any production or public postgres host is rejected", () => {
  for (const url of [
    "postgresql://user:pass@postgres.railway.internal:5432/prod",
    "postgresql://user:pass@containers-us-west-99.railway.app:5432/prod",
    "postgresql://user:pass@localhost:5432/prod",
    "http://user:pass@postgres-vycl.railway.internal:5432/db",
    "invalid"
  ]) {
    assert.throws(() => check({ ...base, DATABASE_URL: url }), /STAGING_ISOLATION_UNVERIFIED/);
  }
});

test("missing DB credentials and enabled external integrations are rejected", () => {
  for (const patch of [
    { DATABASE_URL: "postgresql://user@postgres-vycl.railway.internal/db" },
    { KSEF_SYNC_ENABLED: "true" },
    { KSEF_DEHERUS_SYNC_ENABLED: "true" },
    { CLAUDE_DEV_ENABLED: "true" },
    { WHATSAPP_SEND_ENABLED: "true" },
    { OPENAI_API_KEY: "fake-token" },
    { ANTHROPIC_API_KEY: "fake-token" },
    { WHATSAPP_ACCESS_TOKEN: "fake-token" },
    { DEKONICA_MAIL_PASSWORD: "fake-token" }
  ]) {
    assert.throws(() => check({ ...base, ...patch }), /STAGING_ISOLATION_UNVERIFIED/);
  }
});

test("absent or unverified feature flags fail closed", () => {
  const env = { ...base };
  delete env.CLAUDE_DEV_ENABLED;
  assert.throws(() => check(env), /STAGING_ISOLATION_UNVERIFIED/);
});
