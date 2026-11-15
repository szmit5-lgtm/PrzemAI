"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const Module=require("node:module");
const path=require("node:path");
const target=path.resolve(__dirname,"../api/services/BankStatementImportService.js");

function loadWithDb(db){
 const original=Module._load;
 Module._load=function(request,parent,isMain){
  if(parent?.filename===target&&request==="../../lib/prisma")return db;
  if(parent?.filename===target&&request==="./OrganizationFinanceService")
   return {OrganizationFinanceService:class {async accessible(userId,orgId){
    if(userId!=="owner"||!["dek","deh"].includes(orgId))throw Error("access denied");
   }}};
  if(parent?.filename===target&&request==="./OrganizationService")
   return {OrganizationError:class extends Error{constructor(msg,status){super(msg);this.status=status;}}};
  return original.call(this,request,parent,isMain);
 };
 try{delete require.cache[target];return require(target).importStatement;}
 finally{Module._load=original;delete require.cache[target];}
}
function mockDb(){
 const state={statements:[],transactions:[],accounts:[]};
 const tx={
  bankAccount:{async upsert({where,create}){
   let a=state.accounts.find(x=>x.organizationId===where.organizationId_iban.organizationId&&x.iban===where.organizationId_iban.iban);
   if(!a){a={...create,id:"account-"+state.accounts.length};state.accounts.push(a);}return a;
  }},
  bankStatement:{
   async findFirst({where}){return state.statements.find(x=>x.organizationId===where.organizationId&&x.bankAccountId===where.bankAccountId&&x.statementNumber===where.statementNumber)||null;},
   async create({data}){const a={id:"statement-"+state.statements.length,...data};state.statements.push(a);return a;}
  },
  bankTransaction:{async createMany({data}){state.transactions.push(...data);return{count:data.length};}}
 };
 return {state,organizationMembership:{async findFirst({where}){return where.userId==="owner"&&where.role==="OWNER"&&["dek","deh"].includes(where.organizationId)?{id:"membership"}:null;}},$transaction:fn=>fn(tx)};
}
function payload(amount="1 234,56",opening="100,00",closing="1 334,56"){
 return {iban:"30 1090 1883 0000 0001 6298 2145",statementNumber:"TEST/2026/11",periodStart:"2026-11-01",periodEnd:"2026-11-30",
  openingBalance:opening,closingBalance:closing,transactions:[{date:"2026-11-05",amount,description:"Synthetic test invoice"}]};
}
test("bank import accepts Polish grouped amounts and reconciles in integer grosz",async()=>{
 const db=mockDb(),importStatement=loadWithDb(db);
 const result=await importStatement("owner","dek",payload());
 assert.equal(result.transactionCount,1);
 assert.equal(db.state.transactions[0].amount,"1234.56");
 assert.equal(db.state.statements[0].closingBalance,"1334.56");
 await assert.rejects(importStatement("owner","dek",payload()),e=>e.status===409);
});
test("bank import enforces balance, tenant and owner boundary",async()=>{
 const db=mockDb(),importStatement=loadWithDb(db);
 await assert.rejects(importStatement("owner","dek",payload("1 234,56","100,00","1 333,56")) ,/Saldo początkowe/);
 await assert.rejects(importStatement("member","dek",payload()),/access denied/);
 assert.equal(db.state.statements.length,0);
 await importStatement("owner","deh",payload());
 assert.equal(db.state.statements[0].organizationId,"deh");
});
