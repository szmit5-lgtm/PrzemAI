"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { getKsefSyncEligibility } = require("../lib/ksefSyncEligibility");

const ready = {
  KSEF_SYNC_ENABLED: "true",
  KSEF_OWNER_USER_ID: "user-owner",
  KSEF_NIP: "1234567890",
  KSEF_TOKEN: "SECRET-DO-NOT-LOG",
  KSEF_ENVIRONMENT: "production"
};

test("KSeF fails closed without an explicit owner even if the token exists", () => {
  assert.deepEqual(getKsefSyncEligibility("user-owner", { ...ready, KSEF_OWNER_USER_ID: undefined }), {
    allowed: false, status: "OWNER_NOT_CONFIGURED"
  });
  assert.deepEqual(getKsefSyncEligibility("user-owner", { ...ready, KSEF_OWNER_USER_ID: " " }), {
    allowed: false, status: "OWNER_NOT_CONFIGURED"
  });
});

test("KSeF refuses a token for other users and padded owner identifiers", () => {
  for (const userId of ["another-user", " user-owner", "", undefined]) {
    assert.equal(getKsefSyncEligibility(userId, ready).allowed, false);
  }
  assert.deepEqual(getKsefSyncEligibility("user-owner", { ...ready, KSEF_OWNER_USER_ID: "user-owner " }), {
    allowed: false, status: "OWNER_NOT_CONFIGURED"
  });
});

test("KSeF readiness requires explicit opt-in, production, valid NIP and token", () => {
  const cases = [
    [{ ...ready, KSEF_SYNC_ENABLED: "false" }, "DISABLED"],
    [{ ...ready, KSEF_NIP: "123" }, "INVALID_NIP"],
    [{ ...ready, KSEF_TOKEN: "" }, "TOKEN_MISSING"],
    [{ ...ready, KSEF_ENVIRONMENT: "test" }, "ENVIRONMENT_NOT_PRODUCTION"]
  ];
  for (const [env, status] of cases) {
    assert.deepEqual(getKsefSyncEligibility("user-owner", env), { allowed: false, status });
  }
  assert.deepEqual(getKsefSyncEligibility("user-owner", ready), { allowed: true, status: "READY" });
});

test("KSeF diagnostics reveal no token, NIP or user identifier", () => {
  for (const env of [ready, { ...ready, KSEF_OWNER_USER_ID: undefined }, { ...ready, KSEF_TOKEN: "" }]) {
    const message = JSON.stringify(getKsefSyncEligibility("user-owner", env));
    for (const secret of ["SECRET-DO-NOT-LOG", "1234567890", "user-owner"]) {
      assert.equal(message.includes(secret), false);
    }
  }
});
