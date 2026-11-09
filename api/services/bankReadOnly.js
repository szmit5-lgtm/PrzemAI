"use strict";

/**
 * Bank data normalization boundary. No bank network access or payment methods.
 * Amounts remain decimal strings to avoid floating-point rounding.
 */
function normalizeBankTransaction(input) {
  if (!input || typeof input !== "object") throw new TypeError("Transaction required");
  const { externalId, accountRef, bookedAt, amount, currency } = input;
  if (typeof externalId !== "string" || !externalId.trim() || externalId.length > 256) throw new TypeError("Invalid externalId");
  if (typeof accountRef !== "string" || !accountRef.trim()) throw new TypeError("Invalid accountRef");
  if (typeof amount !== "string" || !/^-?(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(amount)) throw new TypeError("Invalid decimal amount");
  if (typeof currency !== "string" || !/^[A-Z]{3}$/.test(currency)) throw new TypeError("Invalid currency");
  if (typeof bookedAt !== "string" || !/^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(bookedAt) || !Number.isFinite(Date.parse(bookedAt))) throw new TypeError("Invalid bookedAt");
  return Object.freeze({
    externalId: externalId.trim(),
    accountRef: accountRef.trim(),
    bookedAt,
    amount,
    currency,
    description: typeof input.description === "string" ? input.description : "",
    counterparty: typeof input.counterparty === "string" ? input.counterparty : ""
  });
}

function transactionDeduplicationKey(companyId, transaction) {
  if (typeof companyId !== "string" || !companyId.trim()) throw new TypeError("Company scope required");
  const t = normalizeBankTransaction(transaction);
  return JSON.stringify([companyId.trim(), t.accountRef, t.externalId]);
}

module.exports = { normalizeBankTransaction, transactionDeduplicationKey };
