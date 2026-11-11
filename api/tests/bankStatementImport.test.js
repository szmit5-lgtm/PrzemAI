"use strict";
const assert = require("node:assert/strict");
const {test} = require("node:test");
const {parseCsv,moneyToCents,normalizeDate,normalizeBankRow,invoiceCandidates} = require("../services/BankStatementImport");
test("quoted CSV, Polish decimals, valid dates", () => {
 assert.deepEqual(parseCsv('data;opis;kwota\n2026-05-04;"Faktura; numer";"1 234,56"'), [["data","opis","kwota"],["2026-05-04","Faktura; numer","1 234,56"]]);
 assert.equal(moneyToCents("1 234,56"),123456);
 assert.equal(normalizeDate("04.05.2026"),"2026-05-04");
 assert.throws(()=>normalizeDate("31.02.2026"));
});
test("separate companies, stable fingerprints and review required", () => {
 const row={date:"2026-05-04",amount:"-500,00",description:"Zapłata częściowa FV/12"};
 const options={organizationId:"dekonica",accountIban:"30 1090 1883 0000 0001 6298 2145"};
 const a=normalizeBankRow(row,options), b=normalizeBankRow(row,options);
 assert.equal(a.fingerprint,b.fingerprint);
 assert.notEqual(a.fingerprint,normalizeBankRow(row,{...options,organizationId:"deherus"}).fingerprint);
 assert.equal(a.requiresDuplicateReview,true);
 assert.deepEqual(invoiceCandidates(a,[{id:"f1",invoiceNumber:"FV/12",grossAmount:"1000,00"}]),[{invoiceId:"f1",status:"POSSIBLE_PARTIAL",needsApproval:true}]);
});
