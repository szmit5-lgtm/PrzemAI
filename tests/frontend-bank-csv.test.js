"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const source = fs.readFileSync(path.join(__dirname, "../frontend/src/lib/bankStatementCsv.js"), "utf8");
const parser = import("data:text/javascript;base64," + Buffer.from(source).toString("base64"));
const header = "date;amount;description";

test("bank CSV preserves exact decimal strings, BOM, quoted headers and multiline descriptions", async () => {
 const {parseCsv} = await parser;
 assert.deepEqual(parseCsv('\uFEFF"date";amount;description;reference\r\n15.11.2026;"-1 234,56";"FV; test ""opis""\nkoniec";FV/1'), [{
  date:"2026-11-15",amount:"-1234.56",description:'FV; test "opis"\nkoniec',reference:"FV/1",counterparty:""
 }]);
 assert.equal(parseCsv(header+'\n2026-11-15;9999999999999999.99;Test')[0].amount,"9999999999999999.99");
});

test("bank CSV rejects shifted columns and duplicate or empty headers", async () => {
 const {parseCsv} = await parser;
 for(const csv of [header+'\n2026-11-15;1;Opis;extra',header+'\n2026-11-15;1',
  'date;amount;description;AMOUNT\n2026-11-15;1;Opis;2',
  'date;amount;description;\n2026-11-15;1;Opis;'])assert.throws(()=>parseCsv(csv),/kolumn|Nagłówki/);
});

test("bank CSV rejects broken quotes rather than changing transaction descriptions", async () => {
 const {parseCsv} = await parser;
 for(const description of ['abc"def"','"abc"tail','"abc','"abc" "def"']) {
  assert.throws(()=>parseCsv(header+'\n2026-11-15;1;'+description),/cudzysłow/);
 }
});

test("bank CSV rejects invalid dates and unsupported amounts before submission", async () => {
 const {parseCsv} = await parser;
 for(const amount of ['1e3','Infinity','1.001','1,23.45','10000000000000000.00','']) {
  assert.throws(()=>parseCsv(header+'\n2026-11-15;'+amount+';Test'),/kwota/);
 }
 assert.throws(()=>parseCsv(header+'\n2026-02-30;1;Test'),/data/);
});

test("bank CSV accepts a long statement at 3000 rows and rejects 3001", async () => {
 const {parseCsv} = await parser;
 const row='\n2026-11-15;0,01;Test';
 assert.equal(parseCsv(header+row.repeat(3000)).length,3000);
 assert.throws(()=>parseCsv(header+row.repeat(3001)),/3000/);
});
