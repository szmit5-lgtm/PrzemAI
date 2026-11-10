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


test("KSeF rejects malformed NIPs and whitespace-only credentials without leaking input", () => {
  const invalidNips = ["012345678", "01234567890", "12345 7890", "１２３４５６７８９０", "12345\\n7890", "", undefined];
  for (const nip of invalidNips) {
    assert.deepEqual(getKsefSyncEligibility("user-owner", { ...ready, KSEF_NIP: nip }), {
      allowed: false, status: "INVALID_NIP"
    });
  }
  for (const token of [" ", String.fromCharCode(9, 10), undefined, null]) {
    assert.deepEqual(getKsefSyncEligibility("user-owner", { ...ready, KSEF_TOKEN: token }), {
      allowed: false, status: "TOKEN_MISSING"
    });
  }
  for (const flag of [true, "TRUE", "1", " true ", undefined]) {
    assert.deepEqual(getKsefSyncEligibility("user-owner", { ...ready, KSEF_SYNC_ENABLED: flag }), {
      allowed: false, status: "DISABLED"
    });
  }
});

test("KSeF rejects non-string tokens and non-production environment variants", () => {
  for (const token of [0, false, {}, [], 12345]) {
    assert.deepEqual(getKsefSyncEligibility("user-owner", { ...ready, KSEF_TOKEN: token }), {
      allowed: false, status: "TOKEN_MISSING"
    });
  }
  for (const environment of ["Production", "production ", " production", "", undefined, null]) {
    assert.deepEqual(getKsefSyncEligibility("user-owner", { ...ready, KSEF_ENVIRONMENT: environment }), {
      allowed: false, status: "ENVIRONMENT_NOT_PRODUCTION"
    });
  }
});

test("KSeF rejects non-string user and owner identities", () => {
  for (const userId of [null, 0, false, {}, [], ["user-owner"]]) {
    assert.deepEqual(getKsefSyncEligibility(userId, ready), {
      allowed: false, status: "INVALID_USER"
    });
  }
  for (const owner of [null, 0, false, {}, [], ["user-owner"]]) {
    assert.deepEqual(getKsefSyncEligibility("user-owner", { ...ready, KSEF_OWNER_USER_ID: owner }), {
      allowed: false, status: "OWNER_NOT_CONFIGURED"
    });
  }
});

test("KSeF rejects padded, blank and mismatched user identities without revealing owner", () => {
  for (const userId of ["", " ", " user-owner", "user-owner ", "\tuser-owner", "user-owner\n"]) {
    assert.deepEqual(getKsefSyncEligibility(userId, ready), {
      allowed: false, status: "INVALID_USER"
    });
  }
  for (const userId of ["another-user", "USER-OWNER", "user-owner-other"]) {
    assert.deepEqual(getKsefSyncEligibility(userId, ready), {
      allowed: false, status: "OWNER_MISMATCH"
    });
  }
});

test("KSeF stays disabled for absent configuration and does not expose credentials", () => {
  for (const env of [undefined, null, {}, { ...ready, KSEF_SYNC_ENABLED: false }]) {
    // Undefined defaults to process.env; force a disabled flag for that case.
    const config = env === undefined ? { ...ready, KSEF_SYNC_ENABLED: undefined } : env;
    assert.deepEqual(getKsefSyncEligibility("user-owner", config), {
      allowed: false, status: "DISABLED"
    });
  }
});

test("KSeF rejects numeric and object-like NIP configuration values", () => {
  for (const nip of [1234567890, 0, null, false, {}, ["1234567890"]]) {
    assert.deepEqual(getKsefSyncEligibility("user-owner", { ...ready, KSEF_NIP: nip }), {
      allowed: false, status: "INVALID_NIP"
    });
  }
});

test("KSeF rejects padded tokens while accepting an exact token", () => {
  for (const token of [" SECRET-DO-NOT-LOG", "SECRET-DO-NOT-LOG ", "\tSECRET-DO-NOT-LOG", "SECRET-DO-NOT-LOG\n"]) {
    assert.deepEqual(getKsefSyncEligibility("user-owner", { ...ready, KSEF_TOKEN: token }), {
      allowed: false, status: "TOKEN_MISSING"
    });
  }
  assert.deepEqual(getKsefSyncEligibility("user-owner", ready), { allowed: true, status: "READY" });
});

test("KSeF denies other users before inspecting company credentials", () => {
  const incomplete = {
    KSEF_SYNC_ENABLED: "true",
    KSEF_OWNER_USER_ID: "user-owner",
    KSEF_NIP: undefined,
    KSEF_TOKEN: undefined,
    KSEF_ENVIRONMENT: undefined
  };
  for (const userId of ["another-user", "USER-OWNER"]) {
    assert.deepEqual(getKsefSyncEligibility(userId, incomplete), {
      allowed: false, status: "OWNER_MISMATCH"
    });
  }
  assert.deepEqual(getKsefSyncEligibility("user-owner", incomplete), {
    allowed: false, status: "INVALID_NIP"
  });
});

test("KSeF eligibility never mutates caller-provided configuration", () => {
  const config = Object.freeze({ ...ready });
  assert.deepEqual(getKsefSyncEligibility("user-owner", config), {
    allowed: true, status: "READY"
  });
  assert.equal(config.KSEF_TOKEN, ready.KSEF_TOKEN);
});

test("KSeF does not read tenant credentials for an unauthorized user", () => {
  const config = {
    KSEF_SYNC_ENABLED: "true",
    KSEF_OWNER_USER_ID: "user-owner",
    get KSEF_NIP() { throw new Error("NIP must remain unread"); },
    get KSEF_TOKEN() { throw new Error("token must remain unread"); },
    get KSEF_ENVIRONMENT() { throw new Error("environment must remain unread"); }
  };
  assert.deepEqual(getKsefSyncEligibility("another-user", config), {
    allowed: false, status: "OWNER_MISMATCH"
  });
});

test("KSeF disabled flag short-circuits before reading owner or credentials", () => {
  const config = {
    KSEF_SYNC_ENABLED: "false",
    get KSEF_OWNER_USER_ID() { throw new Error("owner must remain unread"); },
    get KSEF_NIP() { throw new Error("NIP must remain unread"); },
    get KSEF_TOKEN() { throw new Error("token must remain unread"); },
    get KSEF_ENVIRONMENT() { throw new Error("environment must remain unread"); }
  };
  assert.deepEqual(getKsefSyncEligibility("user-owner", config), {
    allowed: false, status: "DISABLED"
  });
});

test("KSeF invalid user is rejected before reading owner binding or credentials", () => {
  const config = {
    KSEF_SYNC_ENABLED: "true",
    get KSEF_OWNER_USER_ID() { throw new Error("owner must remain unread"); },
    get KSEF_NIP() { throw new Error("NIP must remain unread"); },
    get KSEF_TOKEN() { throw new Error("token must remain unread"); }
  };
  for (const userId of [undefined, null, "", " user-owner", "user-owner ", 123]) {
    assert.deepEqual(getKsefSyncEligibility(userId, config), {
      allowed: false, status: "INVALID_USER"
    });
  }
});
