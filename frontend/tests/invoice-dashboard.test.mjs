import test from "node:test";
import assert from "node:assert/strict";
import { formatInvoicePLN, invoicePeriodTotals } from "../src/lib/invoiceDashboard.mjs";

test("selected invoice period sums signed real net and gross independently", () => {
  const report = { included: 2, rows: [
    { month: 1, direction: "INCOMING", count: 2, net: "90.15", gross: "110.88" },
    { month: 2, direction: "INCOMING", count: 1, net: "-10.15", gross: "-10.96" },
    { month: 4, direction: "OUTGOING", count: 1, net: "100.00", gross: "108.00" }
  ] };
  assert.deepEqual(invoicePeriodTotals(report, "q1"), {
    purchase: { net: 8000n, gross: 9992n }, sales: { net: 0n, gross: 0n }, count: 3
  });
  assert.deepEqual(invoicePeriodTotals(report, "year").sales, { net: 10000n, gross: 10800n });
  assert.equal(formatInvoicePLN(invoicePeriodTotals(report, "m2").purchase.net), "−10,15 zł");
});

test("unavailable scope or missing amounts cannot look like confirmed zero", () => {
  assert.equal(invoicePeriodTotals({ included: 0, rows: [] }, "year"), null);
  const totals = invoicePeriodTotals({ included: 1, rows: [
    { month: 1, direction: "OUTGOING", count: 1, net: null, gross: "123.00" }
  ] }, "m1");
  assert.equal(formatInvoicePLN(totals.sales.net), "—");
  assert.equal(formatInvoicePLN(totals.sales.gross), "123,00 zł");
});
