"use strict";

// Validates a sanitized local MT5 snapshot before any future persistence.
// No credentials, account identifiers, or arbitrary broker payloads accepted.
const ALLOWED = new Set([
  "source", "mode", "readOnly", "asOf", "currency",
  "balance", "equity", "positionCount", "positions"
]);
const POSITION_KEYS = new Set([
  "symbol", "side", "volumeLots", "entryPrice", "currentPrice", "unrealizedPnl"
]);
const MAX_POSITIONS = 200;
function exactKeys(value, allowed) {
  return value && typeof value === "object" && !Array.isArray(value) &&
    Object.keys(value).every(key => allowed.has(key));
}
function amount(value) {
  return typeof value === "number" && Number.isFinite(value);
}
function validateMt5Snapshot(value) {
  if (!exactKeys(value, ALLOWED)) return { ok: false, reason: "invalid_fields" };
  if (value.source !== "MT5_LOCAL" || value.mode !== "REAL" || value.readOnly !== true) {
    return { ok: false, reason: "invalid_source_mode" };
  }
  if (typeof value.asOf !== "string" ||
      !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?(?:Z|\+00:00)$/.test(value.asOf) ||
      !Number.isFinite(Date.parse(value.asOf))) {
    return { ok: false, reason: "invalid_timestamp" };
  }
  if (typeof value.currency !== "string" || !/^[A-Z]{3}$/.test(value.currency)) {
    return { ok: false, reason: "invalid_currency" };
  }
  if (!amount(value.balance) || !amount(value.equity)) {
    return { ok: false, reason: "invalid_amount" };
  }
  if (!Array.isArray(value.positions) || value.positions.length > MAX_POSITIONS ||
      !Number.isInteger(value.positionCount) || value.positionCount !== value.positions.length) {
    return { ok: false, reason: "invalid_positions" };
  }
  for (const position of value.positions) {
    if (!exactKeys(position, POSITION_KEYS) ||
        typeof position.symbol !== "string" ||
        !/^[A-Za-z0-9._#-]{1,40}$/.test(position.symbol) ||
        !["buy", "sell"].includes(position.side) ||
        !amount(position.volumeLots) || position.volumeLots <= 0 ||
        !amount(position.entryPrice) || !amount(position.currentPrice) ||
        !amount(position.unrealizedPnl)) {
      return { ok: false, reason: "invalid_position" };
    }
  }
  return { ok: true, snapshot: {
    source: value.source, mode: value.mode, readOnly: true,
    asOf: value.asOf, currency: value.currency,
    balance: value.balance, equity: value.equity,
    positionCount: value.positionCount,
    positions: value.positions.map(p => ({
      symbol: p.symbol, side: p.side, volumeLots: p.volumeLots,
      entryPrice: p.entryPrice, currentPrice: p.currentPrice,
      unrealizedPnl: p.unrealizedPnl
    }))
  }};
}
module.exports = { validateMt5Snapshot };
