"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");

const raw=fs.readFileSync(path.join(__dirname,"../api/services/AgentService.js"),"utf8");

function harness({taskStatus="ERROR",agentEnabled=true,retryCount=0,owner="owner",key="sales",updated=true}={}){
 const calls=[];
 const task={
  id:"task-1",userId:owner,source:"AGENT",status:taskStatus,
  metadata:{agentKey:key,retryCount,error:"Próbka: błąd wcześniejszego zadania",resultStatus:"FAILED",
   conversation:[{role:"user",content:"Przygotuj ofertę",at:"2026-11-21T11:00:00.000Z"}]},
  updatedAt:new Date("2026-11-21T12:00:00.000Z")
 };
 const db={
  agent:{
   async findFirst(q){calls.push({type:"agent.find",q});
    return q.where.userId===owner&&agentEnabled?{id:"agent-1",status:"ERROR"}:null;},
   async updateMany(q){calls.push({type:"agent.wake",q});return{count:1};}
  },
  task:{
   async findFirst(q){calls.push({type:"task.find",q});
    return q.where.userId===owner&&q.where.id===task.id&&task.status==="ERROR"?{...task}:null;},
   async updateMany(q){calls.push({type:"task.update",q});
    if(!updated||task.status!=="ERROR")return{count:0};
    task.status=q.data.status;
    task.metadata=q.data.metadata;
    return{count:1};}
  }
 };
 const module={exports:{}};
 const context={module,require(name){
  if(name==="../../lib/prisma")return db;
  if(name==="../../core/agents/AgentRunner")return class Runner {};
  if(name==="../../lib/mailAccessPolicy")return{
   isAuthorizedDekonicaUser:()=>false,canSyncMailIntegration:()=>false};
  if(name==="../../lib/agentCatalog")return{
   catalog:[],getAgentDefinition:k=>k==="financial"?{mode:"LIVE_FINANCE"}:
    ["sales","legal"].includes(k)?{mode:"TASK_DRAFT"}:null,examples:[]};
  if(name==="../../lib/agentConversation")return{
   initialTurns:()=>[],appendTurn:()=>[]};
  throw Error("Unexpected import "+name);
 },Date,Error};
 vm.runInNewContext(raw,context,{filename:"AgentService.js"});
 return{service:new module.exports(),task,db,calls};
}
test("only an explicit retry of a failed draft task moves it back into queue and wakes its agent",async()=>{
 const h=harness();
 const result=await h.service.retryAssignment("owner","sales","task-1");
 assert.equal(result.id,"task-1");
 assert.equal(result.status,"TODO");
 assert.equal(result.retryCount,1);
 assert.equal(h.task.status,"TODO");
 assert.equal(h.task.metadata.resultStatus,"QUEUED");
 assert.equal(h.task.metadata.retryCount,1);
 assert.equal(h.task.metadata.error,null);
 assert.equal(h.task.metadata.conversation[0].content,"Przygotuj ofertę");
 assert.deepEqual(h.calls.map(x=>x.type),["agent.find","task.find","task.update","agent.wake"]);
 const update=h.calls.find(x=>x.type==="task.update").q;
 assert.equal(update.where.userId,"owner");
 assert.equal(update.where.status,"ERROR");
 assert.equal(update.where.metadata.equals,"sales");
 assert.equal(update.data.startedAt,null);
 const wake=h.calls.find(x=>x.type==="agent.wake").q;
 assert.equal(wake.where.userId,"owner");
 assert.equal(wake.where.id,"agent-1");
 assert.equal(wake.where.enabled,true);
 assert.equal(wake.data.status,"IDLE");
});
test("non-owner and unrelated agent cannot retry another task",async()=>{
 const own=harness();
 await assert.rejects(own.service.retryAssignment("outsider","sales","task-1"),/zlecenie/);
 assert.equal(own.calls.some(x=>x.type==="task.update"),false);
 const wrong=harness();
 await assert.rejects(wrong.service.retryAssignment("owner","legal","task-1"),/zlecenie/);
 assert.equal(wrong.calls.some(x=>x.type==="task.update"),false);
});
test("financial agent cannot retry via task draft endpoint; disabled agent blocks retry",async()=>{
 const fin=harness({key:"financial"});
 await assert.rejects(fin.service.retryAssignment("owner","financial","task-1"),/Nieobsługiwany/);
 assert.deepEqual(fin.calls,[]);
 const disabled=harness({agentEnabled:false});
 await assert.rejects(disabled.service.retryAssignment("owner","sales","task-1"),/wyłączony/);
 assert.equal(disabled.calls.some(x=>x.type==="task.update"),false);
});
test("retries never run when the job is DONE, queued or already running",async()=>{
 for(const status of ["DONE","TODO","IN_PROGRESS"]){
  const h=harness({taskStatus:status});
  await assert.rejects(h.service.retryAssignment("owner","sales","task-1"),/zakończone błędem/);
  assert.equal(h.calls.some(x=>x.type==="task.update"),false);
 }
});
test("three attempt limit prevents indefinitely expensive retry cycles",async()=>{
 const h=harness({retryCount:3});
 await assert.rejects(h.service.retryAssignment("owner","sales","task-1"),/Limit 3 ponowień/);
 assert.equal(h.calls.some(x=>x.type==="task.update"),false);
});
test("optimistic lock prevents duplicate retry from two browsers and avoids stale worker wake-up",async()=>{
 const h=harness({updated:false});
 await assert.rejects(h.service.retryAssignment("owner","sales","task-1"),/zmieniło się/);
 assert.equal(h.task.status,"ERROR");
 assert.equal(h.calls.some(x=>x.type==="agent.wake"),false);
});
test("user interface asks for explicit retry confirmation with cost awareness and route is scoped",()=>{
 const route=fs.readFileSync(path.join(__dirname,"../api/routes/agentRoutes.js"),"utf8");
 const controller=fs.readFileSync(path.join(__dirname,"../api/controllers/AgentController.js"),"utf8");
 const page=fs.readFileSync(path.join(__dirname,"../frontend/src/app/agents/[key]/page.js"),"utf8");
 const client=fs.readFileSync(path.join(__dirname,"../frontend/src/lib/api.js"),"utf8");
 assert.match(route,/router\.post\("\/workspace\/:key\/assignments\/:taskId\/retry",verifyToken/);
 assert.match(controller,/this\.service\.retryAssignment\(req\.user\.id,req\.params\.key/);
 assert.match(client,/export async function retryAgentAssignment\(key,id\)/);
 assert.match(page,/window\.confirm\("Ponowić to zadanie\?/);
 assert.match(page,/Może to zużyć tokeny AI/);
 assert.match(page,/retryAgentAssignment\(key,task\.id\)/);
 assert.match(page,/Ponów zadanie/);
 assert.match(page,/retryCount\|\|0/);
});
