"use strict";

const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const BusinessTaskAgent=require("../agents/business/BusinessTaskAgent");
const {catalog,getAgentDefinition}=require("../lib/agentCatalog");

function buildFake(tasks){
 const updates=[], reads=[];
 const db={task:{
  async findMany(query){
   reads.push(query);
   return tasks.filter(t=>t.userId===query.where.userId &&
     t.metadata?.agentKey===query.where.metadata.equals &&
     t.status==="TODO").slice(0,query.take);
  },
  async updateMany(args){
   updates.push(args);
   const t=tasks.find(t=>t.id===args.where.id && t.userId===args.where.userId &&
     t.status===args.where.status);
   if(!t)return {count:0};
   t.status=args.data.status;
   if(args.data.metadata)t.metadata=args.data.metadata;
   return {count:1};
  }
 }};
 return {db,updates,reads};
}
test("all ten planned agent keys are distinct, nine are draft processors",()=>{
 assert.equal(catalog.length,10);
 assert.equal(new Set(catalog.map(x=>x.key)).size,10);
 assert.equal(catalog.filter(x=>x.mode==="TASK_DRAFT").length,9);
 assert.equal(getAgentDefinition("financial").mode,"LIVE_FINANCE");
 assert.equal(getAgentDefinition("sales").type,"SALES");
});
test("sales processor handles only same-account matching tasks and stores a draft",async()=>{
 const tasks=[
  {id:"1",userId:"owner",status:"TODO",title:"Oferta schron",
   description:"Przygotuj ofertę schronu dla klienta",metadata:{agentKey:"sales",client:"ABC"}},
  {id:"2",userId:"other",status:"TODO",title:"Secret",
   description:"Nie czytaj",metadata:{agentKey:"sales"}},
  {id:"3",userId:"owner",status:"TODO",title:"Financial work",
   description:"Other task",metadata:{agentKey:"task"}}
 ];
 const {db,updates,reads}=buildFake(tasks);
 let prompt=null;
 const agent=new BusinessTaskAgent({db,ai:{async ask(args){prompt=args;return "Szkic oferty, do zatwierdzenia.";}}});
 const result=await agent.run({userId:"owner",agentKey:"sales"});
 assert.equal(result.metadata.completed,1);
 assert.equal(tasks[0].status,"DONE");
 assert.equal(tasks[0].metadata.resultStatus,"DRAFT_READY");
 assert.match(tasks[0].metadata.result,/Szkic oferty/);
 assert.equal(tasks[1].status,"TODO");
 assert.equal(tasks[2].status,"TODO");
 assert.equal(reads[0].where.userId,"owner");
 assert.equal(reads[0].where.metadata.equals,"sales");
 assert.ok(updates.every(x=>x.where.userId==="owner"));
 assert.match(prompt.system,/Nie masz dostępu do aktualnego internetu/);
 assert.match(prompt.user,/ABC/);
});
test("failed AI call is recorded without fabricated success",async()=>{
 const t={id:"1",userId:"owner",status:"TODO",description:"Przygotuj follow-up",
   metadata:{agentKey:"sales"}};
 const {db}=buildFake([t]);
 const original=console.error;
 console.error=()=>{};
 try{
  const result=await new BusinessTaskAgent({db,ai:{async ask(){throw Error("test failure");}}})
   .run({userId:"owner",agentKey:"sales"});
  assert.equal(result.metadata.failed,1);
  assert.equal(result.metadata.completed,0);
  assert.equal(t.status,"ERROR");
  assert.equal(t.metadata.result,undefined);
 }finally{console.error=original;}
});
test("home dashboard no longer lists static planned agents or invented bank balances",()=>{
 const file=fs.readFileSync(path.join(__dirname,"../frontend/src/app/page.js"),"utf8");
 for(const key of ["getAgents","getFinanceSummary","getFinanceProjects","getOrganizations",
   "getFinancePeriodReport"])assert.match(file,new RegExp(key));
 assert.doesNotMatch(file,/\\b3\\s*120\\s*000\\s*PLN\\b/);
 assert.doesNotMatch(file,/const agents = \\[/);
 assert.match(file,/brak podłączonej bankowości/);
 assert.match(file,/DANE Z SYSTEMU/);
});
