"use strict";

// Each company must resume from its own persisted history checkpoint.
const HISTORY_START = "2026-02-01T00:00:00.000Z";
function getKsefHistoryCursor(config, company, now = new Date()) {
  if (!["dekonica", "deherus"].includes(company)) {
    throw new Error("Invalid KSeF company");
  }
  const key = company === "deherus" ? "ksefDeherusBackfillCursor" : "ksefBackfillCursor";
  const value = config && !Array.isArray(config) && typeof config === "object" ? config[key] : null;
  const date = typeof value === "string" ? Date.parse(value) : NaN;
  const nowMs = new Date(now).getTime();
  if (!Number.isFinite(nowMs)) throw new Error("Invalid KSeF sync time");
  // A checkpoint beyond this sync's clock would silently skip invoices.
  return Number.isFinite(date) && date >= Date.parse(HISTORY_START) && date <= nowMs
    ? new Date(date).toISOString() : HISTORY_START;
}
module.exports = { getKsefHistoryCursor, HISTORY_START };
