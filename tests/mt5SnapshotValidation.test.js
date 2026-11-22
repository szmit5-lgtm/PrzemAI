const test = require("node:test");
const assert = require("node:assert/strict");
const { validateMt5Snapshot } = require("../api/services/mt5SnapshotValidation");
const base = Object.freeze({
  source: "MT5_LOCAL", mode: "REAL", readOnly: true,
  asOf: "2026-11-22T19:57:48.013281+00:00",
  currency: "EUR", balance: 3.24, equity: 3.24,
  positionCount: 0, positions: []
});
test("valid REAL snapshot is accepted", () => {
  assert.equal(validateMt5Snapshot(base).ok, true);
});
test("rejects injected account identifiers or credentials", () => {
  for (const key of ["login", "password", "accountId", "userId", "organizationId", "token"]) {
    assert.equal(validateMt5Snapshot({ ...base, [key]: "secret" }).ok, false);
  }
});
test("rejects DEMO, writable mode and inconsistent positions", () => {
  assert.equal(validateMt5Snapshot({ ...base, mode: "DEMO" }).ok, false);
  assert.equal(validateMt5Snapshot({ ...base, readOnly: false }).ok, false);
  assert.equal(validateMt5Snapshot({ ...base, positionCount: 1 }).ok, false);
});
test("rejects nonfinite amounts and malformed timestamp", () => {
  assert.equal(validateMt5Snapshot({ ...base, balance: Infinity }).ok, false);
  assert.equal(validateMt5Snapshot({ ...base, equity: NaN }).ok, false);
  assert.equal(validateMt5Snapshot({ ...base, asOf: "not-a-date" }).ok, false);
});
test("validates position shape and quantities", () => {
  const p = {symbol:"EURUSD",side:"buy",volumeLots:0.1,entryPrice:1.1,currentPrice:1.2,unrealizedPnl:10};
  assert.equal(validateMt5Snapshot({...base,positionCount:1,positions:[p]}).ok,true);
  assert.equal(validateMt5Snapshot({...base,positionCount:1,positions:[{...p,ticket:123}]}).ok,false);
  assert.equal(validateMt5Snapshot({...base,positionCount:1,positions:[{...p,volumeLots:-1}]}).ok,false);
});
