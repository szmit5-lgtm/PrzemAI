"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {listBankTransactions}=require("../api/services/BankTransactionReadService");
function fakeDb(member){
 let calls=0;
 const db={
  organizationMembership:{findFirst:async({where})=>{
   assert.equal(where.organization.status,"ACTIVE");
   return member;
  }},
  bankTransaction:{findMany:async(options)=>{
   calls++;
   assert.equal(options.where.organizationId,"dekonica");
   assert.equal(options.take,3);
   assert.deepEqual(options.orderBy,[{bookedAt:"desc"},{id:"desc"}]);
   return [
    {id:"a",bookedAt:new Date("2026-11-01"),amount:{toString:()=>"-15.20"},description:"Test payment",counterparty:"Fictional Vendor",reference:"DEMO",reviewStatus:"UNMATCHED",bankAccount:{label:"Test",iban:"PL30109018830000000162982145"}},
    {id:"b",bookedAt:new Date("2026-11-02"),amount:{toString:()=>"100.00"},description:"Test refund",counterparty:"Example",reference:null,reviewStatus:"UNMATCHED",bankAccount:{label:null,iban:"PL30109018830000000162982145"}},
    {id:"c",bookedAt:new Date("2026-11-03"),amount:{toString:()=>"9.00"},description:"Third",counterparty:null,reference:null,reviewStatus:"UNMATCHED",bankAccount:{label:null,iban:"PL30109018830000000162982145"}}
   ];
  }}
 };
 return {db,get calls(){return calls;}};
}
test("bank transactions read requires active finance membership",async()=>{
 for(const member of [null,{role:"MEMBER",financeAccess:false}]){
  const fake=fakeDb(member);
  await assert.rejects(listBankTransactions("user","dekonica",{},fake.db),e=>e.status===403);
  assert.equal(fake.calls,0);
 }
});
test("authorized finance member gets tenant-scoped capped data without full IBAN",async()=>{
 const fake=fakeDb({role:"MEMBER",financeAccess:true});
 const data=await listBankTransactions("user","dekonica",{limit:"2",offset:"0"},fake.db);
 assert.equal(fake.calls,1);
 assert.equal(data.items.length,2);
 assert.equal(data.hasMore,true);
 assert.equal(data.items[0].amount,"-15.20");
 assert.equal(data.items[0].ibanSuffix,"2145");
 assert.equal(data.items[0].bankAccount,undefined);
 assert.equal(data.items[0].externalId,undefined);
});
test("invalid pagination never reads bank records",async()=>{
 const fake=fakeDb({role:"OWNER",financeAccess:false});
 for(const options of [{limit:"101"},{limit:"0"},{offset:"-1"},{limit:"NaN"}]){
  await assert.rejects(listBankTransactions("owner","dekonica",options,fake.db),e=>e.status===400);
 }
 assert.equal(fake.calls,0);
});
