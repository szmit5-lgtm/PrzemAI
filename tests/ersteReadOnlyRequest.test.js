"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { planErsteReadOnlyRequest } = require("../lib/ersteReadOnlyRequest");

test("builds an immutable offline balance request", () => {
  const result = planErsteReadOnlyRequest({ operation: "GetAcct", accountId: "20932721" });
  assert.deepEqual(result, { operation: "GetAcct", accountId: "20932721" });
  assert.equal(Object.isFrozen(result), true);
});

test("builds an offline history request with valid inclusive dates", () => {
  assert.deepEqual(planErsteReadOnlyRequest({
    operation: "GetAcctHistory", accountId: "20932721", from: "2026-10-01", to: "2026-10-31"
  }), { operation: "GetAcctHistory", accountId: "20932721", from: "2026-10-01", to: "2026-10-31" });
});

test("rejects payment and unknown operations before validating account", () => {
  for (const operation of ["ImportTransactions", "CreatePayment", "AuthorizePayment", "Unknown", null]) {
    assert.throws(() => planErsteReadOnlyRequest({ operation, accountId: "20932721" }), /denied/);
  }
});

test("rejects invalid accounts and extraneous balance dates", () => {
  for (const accountId of ["", "x".repeat(35), "ABC 123", "../secret", null]) {
    assert.throws(() => planErsteReadOnlyRequest({ operation: "GetAcct", accountId }), /Invalid account/);
  }
  assert.throws(() => planErsteReadOnlyRequest({ operation: "GetAcct", accountId: "123", from: "2026-10-01" }), /date range/);
});

test("rejects missing, impossible, reversed and malformed history dates", () => {
  for (const [from, to] of [
    [undefined, undefined], ["2026-02-30", "2026-03-01"],
    ["2026-10-31", "2026-10-01"], ["2026-1-01", "2026-10-01"],
    ["2026-10-01", "2026-13-01"], ["2026-10-01", null]
  ]) {
    assert.throws(() => planErsteReadOnlyRequest({ operation: "GetAcctHistory", accountId: "123", from, to }), /date range/);
  }
});
