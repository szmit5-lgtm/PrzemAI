"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { READ_ONLY_OPERATIONS, assertReadOnlyOperation } = require("../lib/ersteReadOnlyPolicy");

test("Erste policy permits only provisional account inquiry operations", () => {
  assert.deepEqual(READ_ONLY_OPERATIONS, ["GetAcct", "GetAcctHistory"]);
  for (const operation of READ_ONLY_OPERATIONS) {
    assert.equal(assertReadOnlyOperation(operation), operation);
  }
});

test("Erste policy rejects payments, imports, authorization and unknown operations", () => {
  for (const operation of ["ImportTransactions", "CreatePayment", "AuthorizePayment", "GetStatements", "getacct", "", null, undefined, {}, ["GetAcct"]]) {
    assert.throws(() => assertReadOnlyOperation(operation), /denied by read-only policy/);
  }
});

test("Erste policy allowlist is immutable", () => {
  assert.equal(Object.isFrozen(READ_ONLY_OPERATIONS), true);
  assert.throws(() => READ_ONLY_OPERATIONS.push("ImportTransactions"), TypeError);
});
