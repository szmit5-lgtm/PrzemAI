"use strict";

// Each company must resume from its own persisted history checkpoint.
const HISTORY_START = "2026-02-01T00:00:00.000Z";
function getKsefHistoryCursor(config, company) {
  if (!["dekonica", "deherus"].includes(company)) {
    throw new Error("Invalid KSeF company");
  }
  const key = company === "deherus" ? "ksefDeherusBackfillCursor" : "ksefBackfillCursor";
  const value = config && !Array.isArray(config) && typeof config === "object" ? config[key] : null;
  const date = typeof value === "string" ? Date.parse(value) : NaN;
  // A future checkpoint would silently skip the backlog; recover from the start.
  return Number.isFinite(date) && date >= Date.parse(HISTORY_START) && date <= Date.now()
    ? new Date(date).toISOString() : HISTORY_START;
}
module.exports = { getKsefHistoryCursor, HISTORY_START };
