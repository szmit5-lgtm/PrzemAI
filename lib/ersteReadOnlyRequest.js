"use strict";

const { assertReadOnlyOperation } = require("./ersteReadOnlyPolicy");

// Offline-only request planner. It never loads credentials or opens a connection.
// Endpoint, signing and payload format must be validated against bank documentation.
function planErsteReadOnlyRequest({ operation, accountId, from, to } = {}) {
  assertReadOnlyOperation(operation);
  if (typeof accountId !== "string" || !/^[A-Za-z0-9]{1,34}$/.test(accountId)) {
    throw new TypeError("Invalid account identifier");
  }
  if (operation === "GetAcct") {
    if (from !== undefined || to !== undefined) throw new TypeError("Balance request cannot contain date range");
    return Object.freeze({ operation, accountId });
  }
  if (typeof from !== "string" || typeof to !== "string" ||
      !/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to) ||
      !isRealDate(from) || !isRealDate(to) || from > to) {
    throw new TypeError("Invalid transaction date range");
  }
  return Object.freeze({ operation, accountId, from, to });
}

function isRealDate(date) {
  const parsed = new Date(date + "T00:00:00.000Z");
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date;
}

module.exports = { planErsteReadOnlyRequest };
