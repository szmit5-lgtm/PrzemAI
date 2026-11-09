"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { normalizeBankTransaction, transactionDeduplicationKey } = require("../api/services/bankReadOnly");
const sample = { externalId: " tx-1 ", accountRef: "acc-1", bookedAt: "2026-11-09", amount: "-120.50", currency: "PLN" };

test("bank normalization preserves exact decimal string and trims external ID", () => {
  const result = normalizeBankTransaction(sample);
  assert.equal(result.amount, "-120.50");
  assert.equal(result.externalId, "tx-1");
  assert.equal(Object.isFrozen(result), true);
});
test("bank input rejects float amounts, invalid currency and missing IDs", () => {
  for (const input of [{ ...sample, amount: 1.25 }, { ...sample, amount: "1e4" }, { ...sample, currency: "pln" }, { ...sample, externalId: "" }]) {
    assert.throws(() => normalizeBankTransaction(input), TypeError);
  }
});
test("deduplication is scoped to company and account", () => {
  const key = transactionDeduplicationKey("company-a", sample);
  assert.notEqual(key, transactionDeduplicationKey("company-b", sample));
  assert.notEqual(key, transactionDeduplicationKey("company-a", { ...sample, accountRef: "acc-2" }));
  assert.throws(() => transactionDeduplicationKey("", sample), /Company scope/);
});
test("read-only boundary does not expose payment commands", () => {
  const api = require("../api/services/bankReadOnly");
  assert.deepEqual(Object.keys(api).sort(), ["normalizeBankTransaction", "transactionDeduplicationKey"]);
});
test("booking dates reject impossible calendar dates and ambiguous timestamps", () => {
  for (const bookedAt of ["2026-02-30", "2025-02-29", "2026-13-01", "2026-11-09T10:20:00", "2026-11-09T25:20:00Z", "2026-11-09T10:20:00+25:00", "2026-11-09junk"]) {
    assert.throws(() => normalizeBankTransaction({ ...sample, bookedAt }), /Invalid bookedAt/, bookedAt);
  }
  for (const bookedAt of ["2024-02-29", "2026-11-09T10:20:00Z", "2026-11-09T10:20:00+01:00"]) {
    assert.equal(normalizeBankTransaction({ ...sample, bookedAt }).bookedAt, bookedAt);
  }
});
