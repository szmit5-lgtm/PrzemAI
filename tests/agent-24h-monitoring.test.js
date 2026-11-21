"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {AgentMonitoringService,summarizeAgentState,auditStatus}=
 require("../api/services/AgentMonitoringService");
const NOW=new Date("2026-11-21T18:00:00.000Z");
const agent=(key,{enabled=true,status="IDLE",nextRunAt=null,lastRunAt=null,runs=[]}={})=>({
 id:"id-"+key,key,name:key,enabled,status,intervalMinutes:15,nextRunAt,lastRunAt,runs
});
const run=(status,startedAt=NOW)=>({status,trigger:"SCHEDULE",startedAt,finishedAt:NOW,
 summary:status==="SUCCESS"?"Zakończono 2 zadania":"TO BE HIDDEN"});
const task=(id,key,status,meta={})=>({
 id,title:"Zlecenie "+id,status,metadata:{agentKey:key,...meta},
 createdAt:new Date("2026-11-21T16:00:00Z"),
 updatedAt:new Date("2026-11-21T17:00:00Z"),startedAt:null
});
test("operator dashboard reports scoped, exact task status totals and recent open work",async()=>{
 const calls=[];
 const db={
  agent:{async findMany(query){calls.push({type:"agent",query});
   return [agent("sales",{lastRunAt:NOW,runs:[run("SUCCESS")]}),
    agent("financial",{status:"RUNNING",runs:[run("RUNNING")]})];}},
  task:{
   async groupBy(query){calls.push({type:"groups",query});return[
    {status:"TODO",_count:{_all:3}},{status:"IN_PROGRESS",_count:{_all:2}},
    {status:"DONE",_count:{_all:10}},{status:"ERROR",_count:{_all:1}}
   ];},
   async findMany(query){calls.push({type:"open",query});
    return [task("q1","sales","TODO"),task("r1","financial","IN_PROGRESS")];}
  }
 };
 const service=new AgentMonitoringService({db,now:()=>NOW});
 const report=await service.report("owner");
 assert.equal(report.source,"PERSISTED_AGENT_AUDIT");
 assert.equal(report.checkedAt,NOW.toISOString());
 assert.deepEqual(report.totals,{queued:3,working:2,completed:10,failed:1});
 assert.equal(report.agents[0].state,"READY");
 assert.equal(report.agents[1].state,"RUNNING");
 assert.deepEqual(report.agents[0].observedOpenItems,{queued:1,working:0,failed:0});
 assert.deepEqual(report.agents[1].observedOpenItems,{queued:0,working:1,failed:0});
 assert.equal(report.openItems[0].agentKey,"sales");
 assert.equal(report.openItems.length,2);
 assert.equal(report.truncated,false);
 assert.deepEqual(calls.map(x=>x.type),["agent","groups","open"]);
 assert.equal(calls[0].query.where.userId,"owner");
 assert.equal(calls[1].query.where.userId,"owner");
 assert.equal(calls[1].query.where.source,"AGENT");
 assert.equal(calls[2].query.where.userId,"owner");
 assert.deepEqual(calls[2].query.where.status.in,["TODO","IN_PROGRESS","ERROR"]);
 assert.equal(calls[0].query.select.runs.take,3);
 assert.equal(calls[2].query.take,121);
});
test("disabled, overdue, failed and not-yet-run agents are shown honestly",()=>{
 assert.equal(auditStatus(agent("x",{enabled:false}),NOW),"DISABLED");
 assert.equal(auditStatus(agent("x",{status:"ERROR"}),NOW),"ATTENTION");
 assert.equal(auditStatus(agent("x",{runs:[run("FAILED")]}),NOW),"ATTENTION");
 assert.equal(auditStatus(agent("x",{nextRunAt:new Date("2026-11-21T16:00:00Z")}),NOW),"OVERDUE");
 assert.equal(auditStatus(agent("x"),NOW),"NO_RUNS");
 assert.equal(auditStatus(agent("x",{runs:[run("SUCCESS")]}),NOW),"READY");
});
test("upstream errors, API keys and large answer payloads are not returned to the user",()=>{
 const agentRow=agent("sales",{runs:[{...run("FAILED"),error:"SECRET-API-KEY",
  metadata:{token:"VERY-SECRET"},summary:"SECRET-API-KEY"}]});
 const input=task("id","sales","ERROR",{
  result:"private 10000-character assistant answer",accessToken:"DO_NOT_SHOW"
 });
 const report=summarizeAgentState([agentRow],[{status:"ERROR",_count:{_all:1}}],[input],NOW);
 assert.equal(report.agents[0].lastRun.failure,true);
 assert.equal(report.agents[0].lastRun.summary,null);
 assert.equal(report.openItems[0].id,"id");
 assert.equal(report.openItems[0].title,"Zlecenie id");
 for(const secret of ["SECRET-API-KEY","VERY-SECRET","DO_NOT_SHOW","private 10000-character assistant answer"])
  assert.equal(JSON.stringify(report).includes(secret),false);
});
test("task listing is bounded and never pretends to be complete",()=>{
 const tasks=Array.from({length:121},(_,i)=>task("task"+i,"sales","TODO"));
 const result=summarizeAgentState([agent("sales")],
  [{status:"TODO",_count:{_all:1000}}],tasks,NOW);
 assert.equal(result.openItems.length,120);
 assert.equal(result.truncated,true);
 assert.equal(result.totals.queued,1000);
 assert.equal(result.agents[0].observedOpenItems.queued,120);
});
test("a missing authenticated user is rejected before database queries",async()=>{
 let reads=0;
 const db={agent:{async findMany(){reads++;return[];}},
  task:{async groupBy(){reads++;return[];},async findMany(){reads++;return[];}}};
 const service=new AgentMonitoringService({db});
 await assert.rejects(service.report(""),err=>err.status===401);
 await assert.rejects(service.report(" wrong"),err=>err.status===401);
 assert.equal(reads,0);
});
test("route, user interface and browser request contain no changes to completed tasks",()=>{
 const route=fs.readFileSync(path.join(__dirname,"../api/routes/agentRoutes.js"),"utf8");
 const service=fs.readFileSync(path.join(__dirname,"../api/services/AgentMonitoringService.js"),"utf8");
 const frontend=fs.readFileSync(path.join(__dirname,"../frontend/src/app/agents/monitor/page.js"),"utf8");
 const home=fs.readFileSync(path.join(__dirname,"../frontend/src/app/agents/page.js"),"utf8");
 const client=fs.readFileSync(path.join(__dirname,"../frontend/src/lib/api.js"),"utf8");
 assert.match(route,/router\.get\("\/monitor",verifyToken/);
 assert.match(route,/monitor\.report\(req\.user\.id\)/);
 assert.match(client,/export async function getAgentMonitoring\(\)/);
 assert.match(home,/href="\/agents\/monitor"/);
 assert.match(frontend,/getAgentMonitoring\(\)/);
 assert.match(frontend,/setInterval\(\(\)=>setRefresh\(x=>x\+1\),30000\)/);
 assert.match(frontend,/nie mierzy ciągłej dostępności serwera/);
 assert.doesNotMatch(service,/\.updateMany\(|\.deleteMany\(|\.create\(/);
});
