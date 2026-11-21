"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const source=fs.readFileSync(path.join(__dirname,"../api/services/OrganizationBankMonthlyService.js"),"utf8");
const routes=fs.readFileSync(path.join(__dirname,"../api/routes/organizationRoutes.js"),"utf8");
const client=fs.readFileSync(path.join(__dirname,"../frontend/src/lib/api.js"),"utf8");
const bank=fs.readFileSync(path.join(__dirname,"../frontend/src/app/company/[id]/bank/page.js"),"utf8");
const ui=fs.readFileSync(path.join(__dirname,"../frontend/src/app/company/[id]/bank/reports/page.js"),"utf8");
const compare=fs.readFileSync(path.join(__dirname,"../frontend/src/app/company/bank/compare/page.js"),"utf8");

function harness({role="OWNER",incomplete=false}={}){
 const calls={auth:[],accounts:[],statements:[],transactions:[]};
 const bankAccounts=[
  {id:"current",iban:"PL00000000000000000000000021",label:"Rachunek bieżący",accountType:"CURRENT",currency:"PLN"},
  {id:"vat",iban:"PL00000000000000000000000022",label:"Rachunek VAT",accountType:"VAT",currency:"PLN"}
 ];
 if(incomplete)bankAccounts.push({id:"other",iban:"PL00000000000000000000000023",label:"Inny",accountType:"OTHER",currency:"PLN"});
 const bankStatements=[
  {id:"b1",bankAccountId:"current",periodEnd:new Date("2026-10-31T12:00:00Z"),closingBalance:"100.00",sourceType:"STATEMENT",importedAt:new Date("2026-11-01T08:00:00Z")},
  {id:"b2",bankAccountId:"vat",periodEnd:new Date("2026-10-31T12:00:00Z"),closingBalance:"25.00",sourceType:"STATEMENT",importedAt:new Date("2026-11-01T08:01:00Z")},
  {id:"b3",bankAccountId:"current",periodEnd:new Date("2026-09-30T12:00:00Z"),closingBalance:"90.00",sourceType:"STATEMENT",importedAt:new Date("2026-10-01T08:01:00Z")},
  {id:"b4",bankAccountId:"vat",periodEnd:new Date("2026-09-30T12:00:00Z"),closingBalance:"30.00",sourceType:"STATEMENT",importedAt:new Date("2026-10-01T08:01:00Z")}
 ];
 const transactions=[
  {id:"t1",bankAccountId:"current",bookedAt:new Date("2026-10-10T12:00:00Z"),amount:"40.00"},
  {id:"t2",bankAccountId:"current",bookedAt:new Date("2026-10-11T12:00:00Z"),amount:"-30.00"},
  {id:"t3",bankAccountId:"vat",bookedAt:new Date("2026-10-11T12:00:00Z"),amount:"10.00"},
  {id:"t4",bankAccountId:"vat",bookedAt:new Date("2026-10-12T12:00:00Z"),amount:"-15.00"},
  {id:"t5",bankAccountId:"current",bookedAt:new Date("2025-10-01T12:00:00Z"),amount:"1000.00"}
 ];
 const db={
  bankAccount:{async findMany(options){calls.accounts.push(options);return bankAccounts;}},
  bankStatement:{async findMany(options){calls.statements.push(options);return bankStatements.filter(x=>
   x.periodEnd<options.where.periodEnd.lt);}},
  bankTransaction:{async findMany(options){calls.transactions.push(options);return transactions.filter(x=>
   x.bookedAt>=options.where.bookedAt.gte&&x.bookedAt<options.where.bookedAt.lt);}}
 };
 const access={async authorize(userId,organizationId){
  calls.auth.push({userId,organizationId});
  if(role==="NONE")throw Object.assign(new Error("Brak dostępu"),{status:403});
 }};
 const context={module:{exports:{}},require(name){
  if(name==="../../lib/prisma")return db;
  if(name==="./OrganizationBankAccessService")return {OrganizationBankAccessService:class {}};
  if(name==="./OrganizationService")return {OrganizationError:class OrganizationError extends Error{
   constructor(message,status=400){super(message);this.status=status;}
  }};
  throw Error("Unexpected dependency "+name);
 }};
 vm.runInNewContext(source,context,{filename:"OrganizationBankMonthlyService.js"});
 return {service:new context.module.exports.OrganizationBankMonthlyService({db,access}),calls,helpers:context.module.exports};
}
test("bank monthly report has separate confirmed VAT and current balances and their combined sum",async()=>{
 const {service,calls}=harness();
 const result=await service.report("owner","dekonica","2026");
 const october=result.months[9];
 assert.equal(result.source,"IMPORTED_BANK_STATEMENTS");
 assert.equal(result.organizationId,"dekonica");
 assert.equal(result.year,2026);
 assert.equal(result.months.length,12);
 assert.equal(october.currencies[0].currency,"PLN");
 assert.equal(october.currencies[0].currentBalance,"100.00");
 assert.equal(october.currencies[0].vatBalance,"25.00");
 assert.equal(october.currencies[0].balance,"125.00");
 assert.equal(october.currencies[0].inflows,"50.00");
 assert.equal(october.currencies[0].outflows,"45.00");
 assert.equal(october.currencies[0].net,"5.00");
 assert.equal(october.currencies[0].transactions,4);
 assert.equal(october.accounts.length,2);
 assert.equal(calls.accounts[0].where.organizationId,"dekonica");
 assert.equal(calls.statements[0].where.organizationId,"dekonica");
 assert.equal(calls.transactions[0].where.organizationId,"dekonica");
 assert.equal(calls.transactions[0].where.bookedAt.gte.toISOString(),"2026-01-01T00:00:00.000Z");
});
test("missing one account's statement cannot fabricate grand total or hide confirmed VAT balance",async()=>{
 const {service}=harness({incomplete:true});
 const result=await service.report("owner","dekonica",2026);
 const october=result.months[9].currencies[0];
 assert.equal(october.currentBalance,"100.00");
 assert.equal(october.vatBalance,"25.00");
 assert.equal(october.otherBalance,null);
 assert.equal(october.balance,null);
 assert.equal(october.missingBalances,1);
});
test("earlier statement is last-known, never falsely shown as exact month-end balance",async()=>{
 const {service}=harness();
 const result=await service.report("owner","dekonica",2026);
 const november=result.months[10];
 assert.equal(november.currencies[0].currentBalance,null);
 assert.equal(november.currencies[0].vatBalance,null);
 assert.equal(november.currencies[0].balance,null);
 assert.equal(november.accounts[0].lastKnownBalance,"100.00");
 assert.equal(november.accounts[0].lastKnownAt,"2026-10-31");
 assert.equal(november.accounts[0].confirmedMonthEnd,false);
});
test("nonmember is denied before bank account or transaction queries",async()=>{
 const {service,calls}=harness({role:"NONE"});
 await assert.rejects(service.report("outsider","dekonica",2026),err=>err.status===403);
 assert.equal(calls.accounts.length,0);
 assert.equal(calls.statements.length,0);
 assert.equal(calls.transactions.length,0);
});
test("integer cents preserve precision and separate currency pools",()=>{
 const {helpers}=harness();
 const inputs=[
  {currency:"PLN",accountType:"CURRENT",closingBalance:"100.05",inflows:"20.10",outflows:"1.02",transactionCount:2},
  {currency:"PLN",accountType:"VAT",closingBalance:"0.30",inflows:"2.10",outflows:"1.90",transactionCount:2},
  {currency:"EUR",accountType:"CURRENT",closingBalance:"50.00",inflows:"1.00",outflows:"0.00",transactionCount:1}
 ];
 const totals=helpers.totalsForCurrency(inputs);
 assert.equal(totals.length,2);
 const pln=totals.find(x=>x.currency==="PLN");
 assert.equal(pln.balance,"100.35");
 assert.equal(pln.inflows,"22.20");
 assert.equal(pln.outflows,"2.92");
 assert.equal(pln.vatBalance,"0.30");
 assert.equal(totals.find(x=>x.currency==="EUR").balance,"50.00");
 assert.equal(helpers.money(helpers.toCents("90071992547409999.99")),"90071992547409999.99");
});
test("bank report UI and company comparison expose separate VAT state, no shared transactions",()=>{
 assert.match(routes,/router\.get\("\/:id\/bank\/monthly\/:year",verifyToken/);
 assert.match(routes,/bankMonthly\.report\(req\.user\.id,req\.params\.id,req\.params\.year\)/);
 assert.match(client,/getOrganizationBankMonthlyReport\(orgId,year\)/);
 assert.match(bank,/bank\/reports"/);
 assert.match(ui,/Rachunek VAT/);
 assert.match(ui,/currentBalance/);
 assert.match(ui,/vatBalance/);
 assert.match(ui,/Brak wyciągu potwierdzającego saldo/);
 assert.match(ui,/Porównanie miesięcy/);
 assert.match(compare,/getOrganizations\(\)/);
 assert.match(compare,/org\.role==="OWNER"/);
 assert.match(compare,/getOrganizationBankMonthlyReport\(org\.id,year\)/);
 assert.match(compare,/Rachunek VAT/);
 assert.match(compare,/summary\.vatBalance/);
 assert.doesNotMatch(compare,/bankTransaction\.findMany/);
});
