import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const source=readFileSync(new URL("../src/app/company/[id]/finance/page.js",import.meta.url),"utf8");
test("company KSeF action uses selected company name instead of hard-coded Dekonica",()=>{
 assert.match(source,/Połącz KSeF \$\{companyName\|\|"firmy"\}/);
 assert.doesNotMatch(source,/Połącz KSeF Dekonica/);
 assert.match(source,/linkOrganizationKsef\(id\)/);
});
test("unavailable KSeF link does not falsely claim only Dekonica is supported",()=>{
 assert.doesNotMatch(source,/automatyczne podłączenie jest dostępne tylko dla pilotażowej integracji Dekonica/i);
});
