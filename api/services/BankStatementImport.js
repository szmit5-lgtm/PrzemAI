"use strict";

// Safe, deterministic foundation for bank CSV imports.
// No persistence and no automatic invoice paid-status changes.
const crypto = require("node:crypto");

function parseCsv(input, separator = ";") {
  if (![";", ",", "\t"].includes(separator)) throw new Error("Unsupported CSV separator");
  const text = String(input || "").replace(/^\uFEFF/, "");
  const rows = []; let row = []; let field = ""; let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') {
      if (field.trim()) throw new Error("Invalid CSV quoting");
      quoted = true;
    } else if (ch === separator) { row.push(field); field = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field); field = "";
      if (row.some(v => v.trim())) rows.push(row);
      row = [];
    } else field += ch;
  }
  if (quoted) throw new Error("Unterminated CSV quoted field");
  row.push(field);
  if (row.some(v => v.trim())) rows.push(row);
  return rows;
}

function moneyToCents(value) {
  let raw = String(value ?? "").trim().replace(/[\s\u00a0]/g, "");
  if (!raw) throw new Error("Missing amount");
  if (raw.includes(",") && raw.includes(".")) {
    raw = raw.lastIndexOf(",") > raw.lastIndexOf(".")
      ? raw.replace(/\./g, "").replace(",", ".")
      : raw.replace(/,/g, "");
  } else if (raw.includes(",")) raw = raw.replace(",", ".");
  if (!/^-?\d+(?:\.\d{1,2})?$/.test(raw)) throw new Error("Invalid amount");
  const negative = raw.startsWith("-");
  const [whole, fraction = ""] = (negative ? raw.slice(1) : raw).split(".");
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  if (!Number.isSafeInteger(cents)) throw new Error("Amount out of range");
  return negative ? -cents : cents;
}

function normalizeDate(value) {
  const s = String(value || "").trim();
  let y, m, d;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) [y, m, d] = s.split("-").map(Number);
  else if (/^\d{2}[.\-/]\d{2}[.\-/]\d{4}$/.test(s)) [d, m, y] = s.split(/[.\-/]/).map(Number);
  else throw new Error("Invalid transaction date");
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d)
    throw new Error("Invalid calendar date");
  return date.toISOString().slice(0, 10);
}

function normalizeIban(value) {
  const iban = String(value || "").replace(/\s/g, "").toUpperCase();
  if (!/^(?:PL)?\d{26}$/.test(iban)) throw new Error("Invalid Polish bank account");
  return iban.startsWith("PL") ? iban : "PL" + iban;
}

function normalizeBankRow(row, {organizationId, accountIban}) {
  if (!organizationId || typeof organizationId !== "string") throw new Error("Missing organization");
  const account = normalizeIban(accountIban);
  const date = normalizeDate(row.date);
  const amountCents = moneyToCents(row.amount);
  const description = String(row.description || "").trim().slice(0, 4000);
  const counterparty = String(row.counterparty || "").trim().slice(0, 500);
  const reference = String(row.reference || "").trim().slice(0, 300);
  const externalId = String(row.externalId || "").trim().slice(0, 300);
  if (!description && !reference && !externalId) throw new Error("Missing transaction description");
  // Identical entries with no bank transaction ID are ambiguous; callers must
  // review duplicates rather than silently dropping legitimate same-day payments.
  const identity = [organizationId, account, externalId ? "id:" + externalId :
    "fallback:" + [date, amountCents, description, counterparty, reference].join("|")];
  return {
    organizationId, accountIban: account, date, amountCents, description,
    counterparty, reference, externalId: externalId || null,
    fingerprint: crypto.createHash("sha256").update(JSON.stringify(identity)).digest("hex"),
    requiresDuplicateReview: !externalId
  };
}

function invoiceCandidates(transaction, invoices) {
  // Conservative suggestion only. Never mark a KSeF invoice paid automatically.
  const haystack = (transaction.description + " " + transaction.reference).toLowerCase();
  return invoices.filter(invoice => {
    if (!invoice.invoiceNumber || !haystack.includes(String(invoice.invoiceNumber).toLowerCase())) return false;
    const gross = invoice.grossAmount == null ? null : moneyToCents(invoice.grossAmount);
    return gross !== null && Math.abs(transaction.amountCents) <= Math.abs(gross);
  }).map(invoice => ({
    invoiceId: invoice.id,
    status: Math.abs(transaction.amountCents) === moneyToCents(invoice.grossAmount)
      ? "POSSIBLE_FULL" : "POSSIBLE_PARTIAL",
    needsApproval: true
  }));
}

module.exports = {parseCsv, moneyToCents, normalizeDate, normalizeIban, normalizeBankRow, invoiceCandidates};
