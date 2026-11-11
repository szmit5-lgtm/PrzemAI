"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { getKsefHistoryCursor, HISTORY_START } = require("../lib/ksefHistoryCursor");

test("Deherus and Dekonica resume from independent checkpoints", () => {
  const config = {
    ksefBackfillCursor: "2026-07-01T00:00:00.000Z",
    ksefDeherusBackfillCursor: "2026-05-01T00:00:00.000Z"
  };
  assert.equal(getKsefHistoryCursor(config, "dekonica"), config.ksefBackfillCursor);
  assert.equal(getKsefHistoryCursor(config, "deherus"), config.ksefDeherusBackfillCursor);
});

test("Deherus never inherits Dekonica cursor", () => {
  assert.equal(getKsefHistoryCursor({ ksefBackfillCursor: "2026-07-01T00:00:00.000Z" }, "deherus"), HISTORY_START);
});

test("invalid and pre-history cursors fall back safely", () => {
  for (const cursor of ["invalid", "2025-01-01", null, {}, ""]) {
    assert.equal(getKsefHistoryCursor({ ksefDeherusBackfillCursor: cursor }, "deherus"), HISTORY_START);
  }
});

test("unknown company is rejected", () => {
  assert.throws(() => getKsefHistoryCursor({}, "other"), /Invalid KSeF company/);
});

test("future checkpoints cannot skip historical invoices for either company", () => {
  const future = new Date(Date.now() + 365 * 86400000).toISOString();
  assert.equal(getKsefHistoryCursor({ ksefBackfillCursor: future }, "dekonica"), HISTORY_START);
  assert.equal(getKsefHistoryCursor({ ksefDeherusBackfillCursor: future }, "deherus"), HISTORY_START);
});

test("valid current checkpoint remains usable", () => {
  const cursor = "2026-03-01T00:00:00.000Z";
  assert.equal(getKsefHistoryCursor({ ksefDeherusBackfillCursor: cursor }, "deherus"), cursor);
});
