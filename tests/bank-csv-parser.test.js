"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { parseBankCsv } = require("../api/services/BankCsvParser");
const csv = value => Buffer.from(value, "utf8");

test("Polish semicolon CSV parses date, signed amounts, names and quoted semicolon", () => {
  const rows = parseBankCsv(csv(
    "Data księgowania;Kwota;Opis operacji;Kontrahent;Referencja\n" +
    '15.11.2026;-10,50;"Opłata; bankowa";Firma testowa;TX001\n' +
    "16.11.2026;120,01;Przelew;Inna firma;TX002\n"
  ));
  assert.equal(rows.length, 2);
  assert.equal(rows[0].date, "2026-11-15");
  assert.equal(rows[0].amount, "-10.50");
  assert.equal(rows[0].description, "Opłata; bankowa");
  assert.equal(rows[1].amount, "120.01");
});

test("quoted CSV amount containing decimal comma parses correctly", () => {
  const rows = parseBankCsv(csv(
    'Date,Amount,Description\n2026-11-15,"1 234,56","Reimbursement"\n'
  ));
  assert.equal(rows[0].amount, "1234.56");
});

test("UTF-8 BOM and literal newlines inside quoted descriptions are allowed", () => {
  const rows = parseBankCsv(csv('\uFEFFData;Kwota;Opis\n2026-11-15;0,01;"Wiersz pierwszy\nWiersz drugi"\n'));
  assert.equal(rows[0].amount, "0.01");
  assert.equal(rows[0].description, "Wiersz pierwszy\nWiersz drugi");
});

test("reject malformed CSV quotes and ambiguous repeated columns", () => {
  for (const input of [
    'Data;Kwota\n2026-11-15;"10,00\n',
    'Data;Kwota\n2026-11-15;"10,00"x\n',
    'Data;Kwota;Amount\n2026-11-15;1,00;2,00\n',
    'Data;Kwota;Kwota\n2026-11-15;1,00;1,00\n',
    'Data;Kwota\n2026-11-15;1,00;extra\n'
  ]) {
    assert.throws(() => parseBankCsv(csv(input)), /CSV|kolumn/);
  }
});

test("reject invalid dates, extra precision, invalid encodings and non-text", () => {
  for (const input of [
    "Data;Kwota\n31.02.2026;1,00\n",
    "Data;Kwota\n2026-11-15;1,001\n",
    "Data;Kwota\n2026-11-15;1e10\n",
    "Data;Kwota\n2026-11-15;99999999999999999,00\n",
    "Data;Kwota\n2026-11-15;1,00\u0000\n"
  ]) {
    assert.throws(() => parseBankCsv(csv(input)), /CSV|kwota|data|tekst/i);
  }
  assert.throws(() => parseBankCsv(Buffer.from([0xff,0xfe,0x00])), /encoded|valid|utf|UTF|decode|CSV|text/i);
});

test("reject missing required headers and files beyond hard limit", () => {
  assert.throws(() => parseBankCsv(csv("Opis;Kwota\nTest;1,00")), /kolumn/);
  assert.throws(() => parseBankCsv(csv("Data;Opis\n2026-11-15;Test")), /kolumn/);
  assert.throws(() => parseBankCsv(csv("Data;Kwota\n")), /nagłówek/);
  assert.throws(() => parseBankCsv(Buffer.alloc(2 * 1024 * 1024 + 1)), /2 MB/);
});

test("reject 3001 operations before generating any import payload", () => {
  const rows = "Data;Kwota\n" + "2026-11-15;1,00\n".repeat(3001);
  assert.throws(() => parseBankCsv(csv(rows)), /3000/);
});
