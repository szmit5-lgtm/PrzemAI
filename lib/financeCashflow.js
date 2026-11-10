"use strict";

// Pure financial reporting utility. Amounts are integer grosz to avoid float drift.
// Input: { companyId, bookedAt: YYYY-MM-DD, amountGrosz: signed integer,
//          investmentId?: string, source?: string, id?: string }
// Positive = inflow, negative = outflow. Caller must normalize external data first.
function summarizeCashflow(entries, { companyId, from, to, investmentId } = {}) {
  if (!Array.isArray(entries)) throw new TypeError("entries must be an array");
  if (!validDate(from) || !validDate(to) || from > to) throw new TypeError("invalid date range");
  if (typeof companyId !== "string" || !companyId.trim()) throw new TypeError("companyId required");
  if (investmentId !== undefined && (typeof investmentId !== "string" || !investmentId.trim())) {
    throw new TypeError("invalid investmentId");
  }
  const seen = new Set();
  const months = new Map();
  let inflowGrosz = 0, outflowGrosz = 0, count = 0;
  for (const entry of entries) {
    if (!entry || typeof entry !== "object" || typeof entry.companyId !== "string" ||
        !validDate(entry.bookedAt) || !Number.isSafeInteger(entry.amountGrosz)) {
      throw new TypeError("invalid financial entry");
    }
    if (entry.companyId !== companyId || entry.bookedAt < from || entry.bookedAt > to ||
        (investmentId !== undefined && entry.investmentId !== investmentId)) continue;
    if (entry.id !== undefined) {
      const key = entry.companyId + ":" + String(entry.source ?? "unspecified") + ":" + String(entry.id);
      if (seen.has(key)) continue;
      seen.add(key);
    }
    const key = entry.bookedAt.slice(0, 7);
    const row = months.get(key) ?? { month: key, inflowGrosz: 0, outflowGrosz: 0, count: 0 };
    if (entry.amountGrosz >= 0) {
      inflowGrosz = safeAdd(inflowGrosz, entry.amountGrosz);
      row.inflowGrosz = safeAdd(row.inflowGrosz, entry.amountGrosz);
    } else {
      const abs = -entry.amountGrosz;
      if (!Number.isSafeInteger(abs)) throw new RangeError("amount overflow");
      outflowGrosz = safeAdd(outflowGrosz, abs);
      row.outflowGrosz = safeAdd(row.outflowGrosz, abs);
    }
    count++;
    row.count++;
    months.set(key, row);
  }
  const quarters = new Map();
  for (const month of months.values()) {
    const quarter = month.month.slice(0, 4) + "-Q" + (Math.floor((Number(month.month.slice(5, 7)) - 1) / 3) + 1);
    const row = quarters.get(quarter) ?? { quarter, inflowGrosz: 0, outflowGrosz: 0, count: 0 };
    row.inflowGrosz = safeAdd(row.inflowGrosz, month.inflowGrosz);
    row.outflowGrosz = safeAdd(row.outflowGrosz, month.outflowGrosz);
    row.count += month.count;
    quarters.set(quarter, row);
  }
  return {
    companyId, from, to, source: "BANK_TRANSACTIONS",
    explanation: "Przepływy na podstawie zaksięgowanych operacji bankowych, a nie kwot faktur KSeF.",
    ...(investmentId === undefined ? {} : { investmentId }),
    inflowGrosz, outflowGrosz, netGrosz: safeAdd(inflowGrosz, -outflowGrosz),
    count, months: [...months.values()].sort((a, b) => a.month.localeCompare(b.month)),
    quarters: [...quarters.values()].sort((a, b) => a.quarter.localeCompare(b.quarter))
  };
}
function safeAdd(a, b) {
  const result = a + b;
  if (!Number.isSafeInteger(result)) throw new RangeError("amount overflow");
  return result;
}
function validDate(date) {
  if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const parsed = new Date(date + "T00:00:00.000Z");
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date;
}
module.exports = { summarizeCashflow };
