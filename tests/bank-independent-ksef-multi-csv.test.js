"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const read = name => fs.readFileSync(path.join(__dirname,"..",name),"utf8");
const bankAccessSource=read("api/services/OrganizationBankAccessService.js");
const importSource=read("api/services/BankStatementImportService.js");
const routesSource=read("api/routes/organizationRoutes.js");
const financePage=read("frontend/src/app/company/[id]/finance/page.js");
const bankPage=read("frontend/src/app/company/[id]/bank/page.js");

function accessHarness(role="OWNER",financeAccess=false) {
 const calls=[];
 class OrganizationError extends Error {
  constructor(message,status=400){super(message);this.status=status;}
 }
 const db={ organizationMembership: { async findFirst(args) {
  calls.push(args);
  if(financeAccess) return {id:"membership",userId:"u",organizationId:"dekonica",financeAccess:true};
  return null;
 }}};
 const organizations={async membership(userId,organizationId){
   if(role==="NONE")throw new OrganizationError("Brak dostępu do firmy.",403);
   return {role,userId,organizationId};
 }};
 const context={module:{exports:{}},require:name=>{
  if(name==="../../lib/prisma")return db;
  if(name==="./OrganizationService")return {OrganizationService:class {},OrganizationError};
  throw Error(name);
 }};
 vm.runInNewContext(bankAccessSource,context);
 return {service:new context.module.exports.OrganizationBankAccessService({db,organizationService:organizations}),calls};
}

test("owner can access bank independently of KSeF link",async()=>{
 const {service,calls}=accessHarness("OWNER");
 assert.equal((await service.authorize("u","dekonica")).role,"OWNER");
 assert.equal((await service.authorize("u","dekonica",{ownerOnly:true})).role,"OWNER");
 assert.equal(calls.length,0);
 assert.doesNotMatch(bankAccessSource,/organizationFinanceLink|\.accessible\(/);
});

test("active employee without finance grant cannot access bank",async()=>{
 const {service}=accessHarness("MEMBER",false);
 await assert.rejects(service.authorize("u","dekonica"),e=>e.status===403);
 await assert.rejects(service.authorize("u","dekonica",{ownerOnly:true}),e=>e.status===403);
});

test("active employee explicitly granted finance read can read bank but cannot import",async()=>{
 const {service,calls}=accessHarness("MEMBER",true);
 assert.equal((await service.authorize("u","dekonica")).role,"MEMBER");
 assert.equal(calls[0].where.organizationId,"dekonica");
 assert.equal(calls[0].where.userId,"u");
 assert.equal(calls[0].where.financeAccess,true);
 await assert.rejects(service.authorize("u","dekonica",{ownerOnly:true}),e=>e.status===403);
});

test("nonmember cannot see bank even when finance grant elsewhere might exist",async()=>{
 const {service,calls}=accessHarness("NONE",true);
 await assert.rejects(service.authorize("u","dekonica"),e=>e.status===403);
 assert.equal(calls.length,0);
});

test("bank imports require owner and balanced statement without KSeF",async()=>{
 const calls=[];
 class OrganizationError extends Error {
  constructor(message,status=400){super(message);this.status=status;}
 }
 const prisma={$transaction:async fn=>{
  calls.push(["transaction"]);
  return fn({
    bankAccount:{upsert:async args=>{calls.push(["upsert",args]);return {id:"bank-1"};}},
    bankStatement:{
      findFirst:async args=>{calls.push(["find",args]);return null;},
      create:async args=>{calls.push(["create",args]);return {id:"statement-1"};}
    },
    bankTransaction:{createMany:async args=>{calls.push(["transactions",args]);return {count:1};}}
  });
 }};
 const auths=[];
 const context={
  module:{exports:{}},Date,Number,String,JSON,
  require:name=>{
   if(name==="crypto")return require("node:crypto");
   if(name==="../../lib/prisma")return prisma;
   if(name==="./OrganizationBankAccessService")return {OrganizationBankAccessService:class {
    async authorize(...args){auths.push(args);}
   }};
   if(name==="./OrganizationService")return {OrganizationError};
   throw Error(name);
  }
 };
 vm.runInNewContext(importSource,context);
 const service=context.module.exports;
 const valid={iban:"PL61109010140000071219812874",statementNumber:"11/2026",
  periodStart:"2026-11-01",periodEnd:"2026-11-30",
  openingBalance:"100.00",closingBalance:"80.00",
  transactions:[{date:"2026-11-21",amount:"-20.00",description:"Zakup materiałów"}]};
 const result=await service.importStatement("u","dekonica",valid);
 assert.equal(result.transactionCount,1);
 assert.equal(auths[0][1],"dekonica");
 assert.equal(auths[0][2].ownerOnly,true);
 assert.equal(calls.find(c=>c[0]==="upsert")[1].where.organizationId_iban.organizationId,"dekonica");
 assert.equal(calls.find(c=>c[0]==="create")[1].data.organizationId,"dekonica");
 assert.equal(calls.find(c=>c[0]==="transactions")[1].data[0].organizationId,"dekonica");
 const before=calls.length;
 await assert.rejects(service.importStatement("u","dekonica",{...valid,closingBalance:"110.00"}),/Saldo początkowe/);
 assert.equal(calls.length,before);
 assert.doesNotMatch(importSource,/finance\.accessible|OrganizationFinanceService/);
});

test("owner sees bank link without KSeF, PDF preview uses independent bank permission",()=>{
 assert.match(financePage,/status\?\.canView\|\|isBankOwner/);
 assert.match(bankPage,/finance\?\.data\?\.canView\|\|isOwner/);
 assert.match(routesSource,/bankAccess\.authorize\(req\.user\.id,req\.params\.id,\{ownerOnly:true\}\)/);
 assert.doesNotMatch(routesSource,/await financeService\.accessible\(req\.user\.id,req\.params\.id\)/);
});

test("multi-month CSV import requires per-statement owner confirmation",()=>{
 assert.match(bankPage,/multiple accept="\.csv,\.pdf/);
 assert.match(bankPage,/setCsvQueue\(parsed\)/);
 assert.match(bankPage,/async function submitImport/);
 assert.match(bankPage,/importOrganizationBankStatement\(id,\{iban,statementNumber,periodStart,periodEnd,openingBalance,closingBalance,transactions\}\)/);
 assert.match(bankPage,/if\(next\)clearStatementFields\(\)/);
 assert.match(bankPage,/Po zapisaniu bieżącego wyciągu załaduję następny/);
 assert.match(bankPage,/Nie udało się zaimportować wyciągu/);
});
