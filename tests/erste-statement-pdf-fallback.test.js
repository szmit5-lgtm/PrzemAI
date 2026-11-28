"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { parseErsteStatementPdf } = require("../api/services/ErsteStatementPdfParser");

const body = "000000000000000000000001";
const checksum = String(98n - BigInt(body + "252100") % 97n).padStart(2, "0");
const account = checksum + " " + body.match(/.{4}/g).join(" ");
const page = [
  "     NR WYCIĄGU  31-10-2026  01-10-2026  31-10-2026  2026/015",
  "     WYCIĄG Z RACHUNKU BANKOWEGO",
  "     " + account,
  "     Rachunek VAT PLN Liczba pozycji 1",
  "     Saldo początkowe: 20,00",
  "  1 07-10-2026 Operacja VAT     50,00      70,00",
  "     Saldo końcowe: 70,00"
].join("\n");
const failingReader = async () => { throw Error("bad XRef entry"); };

test("layout fallback imports only rehearsed Erste text with matching balances", async () => {
  const input = Buffer.from("%PDF-");
  const parsed = await parseErsteStatementPdf(input, failingReader, async bytes => {
    assert.equal(bytes, input);
    return page + "\f";
  });
  assert.equal(parsed.accounts[0].accountType, "VAT");
  assert.equal(parsed.accounts[0].transactions[0].amount, "50.00");
  await assert.rejects(parseErsteStatementPdf(input, failingReader, async () => page.replace("50,00", "49,00") + "\f"),
    /Saldo i kwota PDF nie są zgodne/);
});

test("layout fallback rejects incomplete and oversized extraction", async () => {
  const input = Buffer.from("%PDF-");
  for (const layout of [page, (page + "\f").repeat(121)]) {
    await assert.rejects(parseErsteStatementPdf(input, failingReader, async () => layout), /Nie odczytano wszystkich stron PDF/);
  }
});
