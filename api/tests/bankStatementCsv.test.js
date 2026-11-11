const test=require("node:test");
const assert=require("node:assert/strict");
const {parseCsvRows,parsePolishAmount}=require("../lib/bankStatementCsv");
test("CSV statement handles BOM, quoted separators, multiline and CRLF",()=>{
 assert.deepEqual(parseCsvRows('\uFEFFData;Opis;Kwota\r\n2026-11-10;"Faktura; 12";"1 234,50"\r\n2026-11-11;"Zwrot ""test""\nkoniec";"-20,00"'),[
  ["Data","Opis","Kwota"],["2026-11-10","Faktura; 12","1 234,50"],["2026-11-11",'Zwrot "test"\nkoniec',"-20,00"]
 ]);
});
test("CSV statement rejects malformed input",()=>{
 assert.throws(()=>parseCsvRows('a;b\n"open;value'),/Unclosed/);
 assert.throws(()=>parseCsvRows('a;b\n1;2;3'),/Inconsistent/);
});
test("amounts use integer grosz and reject ambiguous formatting",()=>{
 assert.equal(parsePolishAmount("1 234,56"),123456);
 assert.equal(parsePolishAmount("-1.234,50"),-123450);
 assert.equal(parsePolishAmount("0,01"),1);
 assert.throws(()=>parsePolishAmount("1,234.50"),/Invalid/);
 assert.throws(()=>parsePolishAmount("1e6"),/Invalid/);
});
