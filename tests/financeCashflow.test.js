"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { summarizeCashflow } = require("../lib/financeCashflow");
const rows = [
  { id: "1", source: "bank", companyId: "dekonica", bookedAt: "2026-10-02", amountGrosz: 12000, investmentId: "mielno" },
  { id: "2", source: "bank", companyId: "dekonica", bookedAt: "2026-10-03", amountGrosz: -3500, investmentId: "mielno" },
  { id: "2", source: "bank", companyId: "dekonica", bookedAt: "2026-10-03", amountGrosz: -3500, investmentId: "mielno" },
  { id: "3", source: "bank", companyId: "dekonica", bookedAt: "2026-11-03", amountGrosz: 7000, investmentId: "zgorzelec" },
  { id: "4", source: "bank", companyId: "kaldeva", bookedAt: "2026-10-03", amountGrosz: 500000 }
];
test("monthly cashflow totals use grosz, company isolation and deduplication", () => {
  const r = summarizeCashflow(rows, { companyId: "dekonica", from: "2026-10-01", to: "2026-11-30" });
  assert.equal(r.inflowGrosz, 19000);
  assert.equal(r.outflowGrosz, 3500);
  assert.equal(r.netGrosz, 15500);
  assert.equal(r.count, 3);
  assert.deepEqual(r.months.map(x => x.month), ["2026-10", "2026-11"]);
});
test("investment filter excludes other projects", () => {
  const r = summarizeCashflow(rows, { companyId: "dekonica", investmentId: "mielno", from: "2026-10-01", to: "2026-12-31" });
  assert.equal(r.count, 2);
  assert.equal(r.netGrosz, 8500);
});
test("invalid dates, amounts and missing company are rejected", () => {
  assert.throws(() => summarizeCashflow(rows, { companyId: "dekonica", from: "2026-02-30", to: "2026-10-31" }), /date/);
  assert.throws(() => summarizeCashflow(rows, { companyId: "", from: "2026-10-01", to: "2026-10-31" }), /companyId/);
  assert.throws(() => summarizeCashflow([{ companyId: "dekonica", bookedAt: "2026-10-01", amountGrosz: 1.5 }], { companyId: "dekonica", from: "2026-10-01", to: "2026-10-31" }), /entry/);
});
