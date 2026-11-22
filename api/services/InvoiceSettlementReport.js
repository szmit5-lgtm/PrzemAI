"use strict";

// Pure, read-only settlement projection. Never interpret absence from an
// incomplete bank import as proof that a liability has not been paid.
function cents(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}
function isoDay(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}
function buildSettlementReport(invoices, allocations = [], corrections = [], options = {}) {
  if (!Array.isArray(invoices) || !Array.isArray(allocations) || !Array.isArray(corrections))
    throw new TypeError("Invalid settlement input");
  const asOf = isoDay(options.asOf || new Date());
  const coverageComplete = options.bankCoverageComplete === true;
  const payments = new Map();
  for (const a of allocations) {
    if (!a || a.confirmed !== true || !a.invoiceId || !a.transactionId) continue;
    const amount = cents(a.amount);
    if (amount === null) continue;
    const key = String(a.invoiceId);
    const existing = payments.get(key) || new Map();
    // Unique invoice/transaction allocation IDs prevent double-counting
    // repeated imports. Multiple allocations from the same transaction
    // require unique allocationId values.
    const allocationId = a.allocationId || a.transactionId;
    existing.set(String(allocationId), amount);
    payments.set(key, existing);
  }
  const adjustments = new Map();
  for (const c of corrections) {
    if (!c || c.verified !== true || !c.originalInvoiceId || !c.id) continue;
    const delta = Number(c.grossDelta);
    if (!Number.isFinite(delta)) continue;
    const key = String(c.originalInvoiceId);
    const existing = adjustments.get(key) || new Map();
    existing.set(String(c.id), Math.round(delta * 100));
    adjustments.set(key, existing);
  }
  const rows = invoices.map(invoice => {
    const original = cents(invoice.grossAmount);
    const paymentCents = [...(payments.get(String(invoice.id))?.values() || [])]
      .reduce((sum, amount) => sum + amount, 0);
    const adjustmentCents = [...(adjustments.get(String(invoice.id))?.values() || [])]
      .reduce((sum, amount) => sum + amount, 0);
    const total = original === null ? null : original + adjustmentCents;
    const remaining = total === null ? null : Math.max(0, total - paymentCents);
    const dueDate = isoDay(invoice.dueDate);
    const daysOverdue = dueDate && asOf && dueDate < asOf
      ? Math.floor((Date.parse(asOf) - Date.parse(dueDate)) / 86400000) : 0;
    let status = "REVIEW";
    if (total !== null && total >= 0) {
      if (remaining === 0) status = "PAID";
      else if (paymentCents > 0) status = "PARTIALLY_PAID";
      else if (!coverageComplete) status = "PAYMENT_UNCONFIRMED";
      else status = daysOverdue > 0 ? "OVERDUE" : "UNPAID";
    }
    return {
      invoiceId: invoice.id, invoiceNumber: invoice.invoiceNumber,
      currency: invoice.currency, dueDate, daysOverdue,
      originalGross: original === null ? null : (original / 100).toFixed(2),
      correctedGross: total === null ? null : (total / 100).toFixed(2),
      paid: (paymentCents / 100).toFixed(2),
      remaining: remaining === null ? null : (remaining / 100).toFixed(2),
      status, paymentEvidence: paymentCents > 0,
      correctionCount: adjustments.get(String(invoice.id))?.size || 0
    };
  });
  return {asOf, bankCoverageComplete: coverageComplete, rows};
}
module.exports = {buildSettlementReport};
