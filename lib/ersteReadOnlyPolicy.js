"use strict";

// Local policy only: this does not grant bank permissions or make network requests.
// Operation names must be verified against Erste's official API contract before use.
const READ_ONLY_OPERATIONS = Object.freeze(["GetAcct", "GetAcctHistory"]);

function assertReadOnlyOperation(operation) {
  if (typeof operation !== "string" || !READ_ONLY_OPERATIONS.includes(operation)) {
    throw new Error("Erste Connect operation denied by read-only policy");
  }
  return operation;
}

module.exports = { READ_ONLY_OPERATIONS, assertReadOnlyOperation };
