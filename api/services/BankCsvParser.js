"use strict";

// Strict CSV parser for user-supplied bank statements. Parsing never writes to DB.
const HEADER_ALIASES = Object.freeze({
  date: ["data", "data operacji", "data ksiegowania", "data księgowania", "booking date", "date"],
  amount: ["kwota", "kwota operacji", "amount", "transaction amount"],
  description: ["opis", "tytul", "tytuł", "opis operacji", "szczegoly", "szczegóły", "description", "title"],
  counterparty: ["kontrahent", "odbiorca", "nadawca", "nazwa kontrahenta", "counterparty", "recipient"],
  reference: ["referencja", "numer referencyjny", "identyfikator", "reference", "transaction id"]
});
function normalizeHeader(value) {
  return String(value).trim().toLowerCase().replace(/\s+/g, " ");
}
function cleanAmount(value) {
  const normalized = String(value).trim().replace(/\u00a0/g, "").replace(/\s/g, "");
  if (!/^[+-]?\d{1,16}(?:[,.]\d{1,2})?$/.test(normalized)) {
    throw new Error("Nieprawidłowa kwota w CSV.");
  }
  return normalized.replace(/^\+/, "").replace(",", ".");
}
function cleanDate(value) {
  const raw = String(value).trim();
  const dotted = /^(\d{2})[.\/-](\d{2})[.\/-](\d{4})$/.exec(raw);
  const iso = dotted ? dotted[3] + "-" + dotted[2] + "-" + dotted[1] : raw;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso) ||
      !Number.isFinite(Date.parse(iso + "T12:00:00Z")) ||
      new Date(iso + "T12:00:00Z").toISOString().slice(0, 10) !== iso) {
    throw new Error("Nieprawidłowa data operacji w CSV.");
  }
  return iso;
}
function rowsFromCsv(source, delimiter) {
  const output = [], record = [];
  let field = "", quoted = false, lastClosedQuote = false;
  for (let i = 0; i < source.length; i++) {
    const ch = source[i];
    if (quoted) {
      if (ch === '"') {
        if (source[i + 1] === '"') { field += '"'; i++; }
        else { quoted = false; lastClosedQuote = true; }
      } else field += ch;
      continue;
    }
    if (lastClosedQuote && ch !== delimiter && ch !== "\n" && ch !== "\r") {
      throw new Error("Nieprawidłowe cudzysłowy w CSV.");
    }
    if (ch === '"' && field === "") { quoted = true; lastClosedQuote = false; }
    else if (ch === delimiter) {
      record.push(field); field = ""; lastClosedQuote = false;
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && source[i + 1] === "\n") i++;
      record.push(field); field = ""; lastClosedQuote = false;
      if (record.some(item => item.trim() !== "")) output.push(record.slice());
      record.length = 0;
      if (output.length > 3001) throw new Error("CSV przekracza limit 3000 operacji.");
    } else if (ch === '"' || (lastClosedQuote && ch !== delimiter)) {
      throw new Error("Nieprawidłowe cudzysłowy w CSV.");
    } else {
      field += ch;
    }
    if (field.length > 16000 || record.length > 50) throw new Error("Nieprawidłowy rozmiar pola CSV.");
  }
  if (quoted) throw new Error("Niezamknięty cudzysłów w CSV.");
  record.push(field);
  if (record.some(item => item.trim() !== "")) output.push(record);
  if (output.length > 3001) throw new Error("CSV przekracza limit 3000 operacji.");
  return output;
}
function parseBankCsv(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0 || buffer.length > 2 * 1024 * 1024) {
    throw new Error("CSV jest pusty lub przekracza 2 MB.");
  }
  const text = new TextDecoder("utf-8", { fatal: true }).decode(buffer).replace(/^\uFEFF/, "");
  if (text.includes("\u0000")) throw new Error("Plik CSV nie jest poprawnym tekstem.");
  const firstLine = text.split(/\r?\n/, 1)[0];
  const delimiter = [";", ",", "\t"].sort((a, b) =>
    (firstLine.split(b).length - 1) - (firstLine.split(a).length - 1))[0];
  const rows = rowsFromCsv(text, delimiter);
  if (rows.length < 2) throw new Error("CSV musi zawierać nagłówek i transakcje.");
  const header = rows[0].map(normalizeHeader);
  const indexes = {};
  for (const [key, aliases] of Object.entries(HEADER_ALIASES)) {
    const matching = header.map((h, i) => aliases.includes(h) ? i : -1).filter(i => i >= 0);
    if (matching.length > 1) throw new Error("Niejednoznaczne kolumny CSV.");
    indexes[key] = matching.length ? matching[0] : -1;
  }
  if (indexes.date < 0 || indexes.amount < 0) {
    throw new Error("CSV wymaga kolumn daty i kwoty.");
  }
  if (header.length > 50 || new Set(header).size !== header.length) {
    throw new Error("Nieprawidłowe lub powtórzone nagłówki CSV.");
  }
  return rows.slice(1).map((row) => {
    if (row.length !== header.length) throw new Error("Wiersz CSV ma inną liczbę kolumn.");
    const optional = key => indexes[key] < 0 ? "" : row[indexes[key]].trim();
    return {
      date: cleanDate(row[indexes.date]),
      amount: cleanAmount(row[indexes.amount]),
      description: optional("description").slice(0, 1000),
      counterparty: optional("counterparty").slice(0, 250),
      reference: optional("reference").slice(0, 250)
    };
  });
}
module.exports = { parseBankCsv };
