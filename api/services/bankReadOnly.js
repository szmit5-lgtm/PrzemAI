"use strict";

/** Pure read-only bank normalization. Never initiate payments. */
function validBookingDate(value) {
  if (typeof value !== "string") return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?(Z|[+-]\d{2}:\d{2}))?$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < 1 || month < 1 || month > 12 || day < 1 || day > 31) return false;
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (day > days[month - 1]) return false;
  if (match[4] === undefined) return true;
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);
  if (hour > 23 || minute > 59 || second > 59) return false;
  const zone = match[7];
  if (zone !== "Z" && (Number(zone.slice(1, 3)) > 23 || Number(zone.slice(4)) > 59)) return false;
  return Number.isFinite(Date.parse(value));
}

function normalizeBankTransaction(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new TypeError("Transaction required");
  const { externalId, accountRef, bookedAt, amount, currency } = input;
  if (typeof externalId !== "string" || !externalId.trim() || externalId.trim().length > 256) throw new TypeError("Invalid externalId");
  if (typeof accountRef !== "string" || !accountRef.trim()) throw new TypeError("Invalid accountRef");
  if (typeof amount !== "string" || !/^-?(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(amount)) throw new TypeError("Invalid decimal amount");
  if (typeof currency !== "string" || !/^[A-Z]{3}$/.test(currency)) throw new TypeError("Invalid currency");
  if (!validBookingDate(bookedAt)) throw new TypeError("Invalid bookedAt");
  return Object.freeze({
    externalId: externalId.trim(),
    accountRef: accountRef.trim(),
    bookedAt, amount, currency,
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
