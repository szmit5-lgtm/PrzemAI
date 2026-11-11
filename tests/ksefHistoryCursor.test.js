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
  const clock = new Date("2026-11-11T16:00:00.000Z");
  const future = "2026-11-12T00:00:00.000Z";
  assert.equal(getKsefHistoryCursor({ ksefBackfillCursor: future }, "dekonica", clock), HISTORY_START);
  assert.equal(getKsefHistoryCursor({ ksefDeherusBackfillCursor: future }, "deherus", clock), HISTORY_START);
});

test("valid current checkpoint remains usable", () => {
  const cursor = "2026-03-01T00:00:00.000Z";
  assert.equal(getKsefHistoryCursor({ ksefDeherusBackfillCursor: cursor }, "deherus"), cursor);
});

test("checkpoint after synchronization clock falls back to history start", () => {
  const now = new Date("2026-04-01T00:00:00.000Z");
  const checkpoint = "2026-05-01T00:00:00.000Z";
  assert.equal(getKsefHistoryCursor({ ksefBackfillCursor: checkpoint }, "dekonica", now), HISTORY_START);
  assert.equal(getKsefHistoryCursor({ ksefDeherusBackfillCursor: checkpoint }, "deherus", now), HISTORY_START);
});

test("checkpoint before synchronization clock is preserved", () => {
  const now = new Date("2026-05-01T00:00:00.000Z");
  const checkpoint = "2026-04-01T00:00:00.000Z";
  assert.equal(getKsefHistoryCursor({ ksefDeherusBackfillCursor: checkpoint }, "deherus", now), checkpoint);
});

test("invalid synchronization clock is rejected", () => {
  assert.throws(() => getKsefHistoryCursor({}, "deherus", "invalid"), /Invalid KSeF sync time/);
});

test("checkpoint exactly at the synchronization clock is accepted", () => {
  const clock = new Date("2026-11-11T16:00:00.000Z");
  const checkpoint = clock.toISOString();
  for (const company of ["dekonica", "deherus"]) {
    const key = company === "deherus" ? "ksefDeherusBackfillCursor" : "ksefBackfillCursor";
    assert.equal(getKsefHistoryCursor({ [key]: checkpoint }, company, clock), checkpoint);
  }
});
