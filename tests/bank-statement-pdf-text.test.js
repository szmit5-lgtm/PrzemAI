"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {previewStatementText}=require("../api/lib/bankStatementPdfText");
const IBAN="30 1090 1883 0000 0001 6298 2145";
function fixture(rows,closing="150,00"){
 return ["Wyciąg 2026/011","Rachunek: "+IBAN,"Saldo początkowe: 100,00",...rows,"Saldo końcowe: "+closing].join("\n");
}
test("PDF text preview recognizes synthetic transfers and reconciles running balance",()=>{
 const data=previewStatementText(fixture([
  "1 03-11-2026 Faktura testowa 25,00 75,00",
  "2 04-11-2026 Zwrot testowy 75,00 150,00"
 ]));
 assert.equal(data.transactionCount,2);
 assert.deepEqual(data.transactions.map(x=>x.amount),["-25.00","75.00"]);
 assert.equal(data.iban,"PL30109018830000000162982145");
 assert.equal(data.statementNumber,"2026/011");
 assert.equal(data.requiresReview,true);
 assert.equal(data.canImportAutomatically,false);
});
test("PDF text preview rejects broken running balance and missing closing balance",()=>{
 assert.throws(()=>previewStatementText(fixture(["1 03-11-2026 Błędna kwota 20,00 75,00"])),/kwota operacji/);
 assert.throws(()=>previewStatementText(fixture(["1 03-11-2026 Test 25,00 75,00"],"70,00")),/saldem końcowym/);
});
test("PDF text preview refuses ambiguous multi-statement and malformed dates",()=>{
 const good=fixture(["1 03-11-2026 Test 25,00 75,00"],"75,00");
 assert.throws(()=>previewStatementText(good+"\nWyciąg 2026/012"),/jednoznacznie/);
 assert.throws(()=>previewStatementText(fixture(["1 31-02-2026 Test 25,00 75,00"],"75,00")),/Nieprawidłowa data/);
});
