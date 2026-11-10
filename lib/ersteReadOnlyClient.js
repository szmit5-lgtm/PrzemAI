"use strict";

const { planErsteReadOnlyRequest } = require("./ersteReadOnlyRequest");

// Deliberately inert transport boundary. The actual Erste Connect API protocol,
// signing and TLS trust configuration must be confirmed before any network code.
function createErsteReadOnlyClient({ transport } = {}) {
  if (typeof transport !== "function") {
    throw new TypeError("A verified read-only transport function is required");
  }

  return Object.freeze({
    async getAccount(accountId) {
      const request = planErsteReadOnlyRequest({ operation: "GetAcct", accountId });
      return transport(request);
    },
    async getAccountHistory(accountId, from, to) {
      const request = planErsteReadOnlyRequest({ operation: "GetAcctHistory", accountId, from, to });
      return transport(request);
    }
  });
}

function createDisabledErsteTransport() {
  return async () => {
    throw new Error("Erste Connect transport disabled pending verified bank API specification and read-only authorization");
  };
}

module.exports = { createErsteReadOnlyClient, createDisabledErsteTransport };
