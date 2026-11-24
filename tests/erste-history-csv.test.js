const test=require("node:test");
const assert=require("node:assert/strict");
const {parseBankCsv}=require("../api/services/BankFileParser");
function account(n){const b=String(n).padStart(24,"0");return String(98n-BigInt(b+"252100")%97n).padStart(2,"0")+b;}
const a=account(1),b=account(2);
const header="Nadawca;Rachunek nadawcy;Odbiorca;Rachunek odbiorcy;Tytuł;Kwota;Waluta;Zaksięgowano;Saldo po operacji";
const rows=[`Firma;${a};X;${b};Koszt;-10,00;PLN;2026-11-02;90,00`,`X;${b};Firma;${a};Wpływ;20,00;PLN;2026-11-03;110,00`,`X;${a};Firma;${b};Wpływ;5,00;PLN;2026-11-03;50,00`];
test("history reconciles multiple accounts",()=>{const p=parseBankCsv(Buffer.from([header,...rows].join("\n")));assert.equal(p.accounts.length,2);assert.equal(p.extractedCount,3);assert.equal(p.accounts[0].openingBalance,"100.00");assert.equal(p.accounts[0].closingBalance,"110.00");});
test("history rejects inconsistent balances",()=>assert.throws(()=>parseBankCsv(Buffer.from([header,rows[0],rows[1].replace("110,00","111,00")].join("\n"))),/ciągłości/));
