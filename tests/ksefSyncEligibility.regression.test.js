"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { getKsefSyncEligibility } = require("../lib/ksefSyncEligibility");

const validEnv = Object.freeze({
  KSEF_SYNC_ENABLED: "true",
  KSEF_OWNER_USER_ID: "owner-1",
  KSEF_NIP: "1234567890",
  KSEF_TOKEN: "test-token",
  KSEF_ENVIRONMENT: "production"
});

test("KSeF eligibility accepts only the configured owner", () => {
  assert.deepEqual(getKsefSyncEligibility("owner-1", validEnv), { allowed: true, status: "READY" });
  assert.deepEqual(getKsefSyncEligibility("other-owner", validEnv), { allowed: false, status: "OWNER_MISMATCH" });
});

test("KSeF eligibility fails closed when the owner binding is absent", () => {
  const { KSEF_OWNER_USER_ID, ...env } = validEnv;
  assert.deepEqual(getKsefSyncEligibility("owner-1", env), { allowed: false, status: "OWNER_NOT_CONFIGURED" });
});

test("KSeF eligibility rejects malformed user IDs without revealing them", () => {
  for (const userId of [undefined, "", " owner-1", "owner-1 ", "owner-1\\n", "owner-1\n"]) {
    assert.deepEqual(getKsefSyncEligibility(userId, validEnv), { allowed: false, status: "INVALID_USER" });
  }
});

test("KSeF eligibility requires an exact production environment and a token", () => {
  assert.deepEqual(getKsefSyncEligibility("owner-1", { ...validEnv, KSEF_ENVIRONMENT: "test" }), { allowed: false, status: "ENVIRONMENT_NOT_PRODUCTION" });
  assert.deepEqual(getKsefSyncEligibility("owner-1", { ...validEnv, KSEF_TOKEN: " " }), { allowed: false, status: "TOKEN_MISSING" });
  assert.deepEqual(getKsefSyncEligibility("owner-1", { ...validEnv, KSEF_NIP: "123" }), { allowed: false, status: "INVALID_NIP" });
});
