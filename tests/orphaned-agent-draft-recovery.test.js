"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {recoverInterruptedDraftTasks,isDraftTask,STALE_TASK_MS}=
 require("../core/agents/OrphanedDraftTaskRecovery");
const NOW=new Date("2026-11-22T14:00:00.000Z");
const old=new Date(NOW.getTime()-120*60000);
const fresh=new Date(NOW.getTime()-10*60000);
function draft(id,userId="owner",agentKey="sales"){
 return {id,userId,source:"AGENT",status:"IN_PROGRESS",
  startedAt:old,updatedAt:old,metadata:{agentKey,conversation:[{role:"user",content:"Zlecenie testowe"}]}};
}
function mock({tasks=[draft("stale")],agents={},allowedWrites=true}={}){
 const queries=[];
 const db={
  task:{
   async findMany(query){
    queries.push({kind:"task.find",query});
    const where=query.where;
    return tasks.filter(t=>t.source===where.source&&t.status===where.status&&
     (!where.userId||t.userId===where.userId)&&
     t.startedAt<where.startedAt.lt&&t.updatedAt<where.updatedAt.lt).slice(0,query.take);
   },
   async updateMany(query){
    queries.push({kind:"task.update",query});
    const where=query.where;
    const row=tasks.find(t=>t.id===where.id&&t.userId===where.userId&&
      t.source===where.source&&t.status===where.status&&
      t.startedAt.getTime()===where.startedAt.getTime()&&
      t.updatedAt.getTime()===where.updatedAt.getTime()&&
      t.metadata?.agentKey===where.metadata.equals);
    if(!row||!allowedWrites)return{count:0};
    row.status=query.data.status;row.metadata=query.data.metadata;
    return{count:1};
   }
  },
  agent:{async findFirst(query){
   queries.push({kind:"agent.find",query});
   return agents[query.where.userId+":"+query.where.key]||null;
  }}
 };
 return{db,tasks,queries};
}
test("stale draft is marked ERROR without new task, new run or paid retry",async()=>{
 const m=mock();
 const report=await recoverInterruptedDraftTasks({db:m.db,now:()=>NOW});
 assert.deepEqual(report,{examined:1,recovered:1,active:0,skipped:0,truncated:false});
 assert.equal(m.tasks[0].status,"ERROR");
 assert.equal(m.tasks[0].metadata.resultStatus,"FAILED");
 assert.equal(m.tasks[0].metadata.recoveredByWatchdog,true);
 assert.match(m.tasks[0].metadata.error,/użyj „Ponów zadanie”/);
 assert.equal(m.tasks[0].metadata.conversation[0].content,"Zlecenie testowe");
 assert.equal(m.queries.filter(x=>x.kind==="task.update").length,1);
 assert.equal(m.queries[0].query.where.source,"AGENT");
 assert.equal(m.queries[0].query.where.status,"IN_PROGRESS");
 assert.equal(m.queries[0].query.take,40);
 assert.equal(STALE_TASK_MS,90*60000);
});
test("long-running active agent with fresh heartbeat keeps its task safely",async()=>{
 const m=mock({agents:{"owner:sales":{id:"ag1",status:"RUNNING",updatedAt:fresh}}});
 const r=await recoverInterruptedDraftTasks({db:m.db,now:()=>NOW});
 assert.equal(r.active,1);
 assert.equal(r.recovered,0);
 assert.equal(m.tasks[0].status,"IN_PROGRESS");
 assert.equal(m.queries.filter(x=>x.kind==="task.update").length,0);
});
test("stale RUNNING agent whose heartbeat died does not protect orphan",async()=>{
 const m=mock({agents:{"owner:sales":{id:"ag1",status:"RUNNING",updatedAt:old}}});
 const r=await recoverInterruptedDraftTasks({db:m.db,now:()=>NOW});
 assert.equal(r.recovered,1);
 assert.equal(m.tasks[0].status,"ERROR");
});
test("financial, missing and unknown agent keys and recent tasks are never changed",async()=>{
 const tasks=[draft("financial","owner","financial"),draft("unknown","owner","nonexistent"),
  draft("missing","owner",null),{...draft("recent"),startedAt:fresh,updatedAt:fresh},
  {...draft("man"),source:"MANUAL"}];
 const m=mock({tasks});
 const r=await recoverInterruptedDraftTasks({db:m.db,now:()=>NOW});
 assert.equal(r.examined,3);
 assert.equal(r.skipped,3);
 assert.equal(r.recovered,0);
 assert.ok(tasks.every(t=>t.status==="IN_PROGRESS"));
 assert.equal(isDraftTask(tasks[0]),false);
 assert.equal(isDraftTask(draft("s")),true);
});
test("owner-scoped worker does not scan or alter tasks belonging to others",async()=>{
 const m=mock({tasks:[draft("owned","owner"),draft("other","someoneElse")]});
 const r=await recoverInterruptedDraftTasks({db:m.db,now:()=>NOW,ownerScope:"owner"});
 assert.equal(r.recovered,1);
 assert.equal(m.tasks[0].status,"ERROR");
 assert.equal(m.tasks[1].status,"IN_PROGRESS");
 assert.equal(m.queries[0].query.where.userId,"owner");
 assert.equal(m.queries.find(x=>x.kind==="task.update").query.where.userId,"owner");
});
test("optimistic lock prevents second worker overwriting already finished work",async()=>{
 const m=mock({allowedWrites:false});
 const r=await recoverInterruptedDraftTasks({db:m.db,now:()=>NOW});
 assert.equal(r.recovered,0);
 assert.equal(m.tasks[0].status,"IN_PROGRESS");
 const where=m.queries.find(x=>x.kind==="task.update").query.where;
 assert.equal(where.status,"IN_PROGRESS");
 assert.equal(where.metadata.equals,"sales");
 assert.equal(where.updatedAt,old);
});
test("shutdown after scan never updates a task or triggers paid AI",async()=>{
 const m=mock();
 const r=await recoverInterruptedDraftTasks({db:m.db,now:()=>NOW,shouldStop:()=>true});
 assert.equal(r.recovered,0);
 assert.equal(m.queries.filter(x=>x.kind==="task.update").length,0);
});
test("worker recovers drafts before processing new work but does not requeue them",()=>{
 const worker=fs.readFileSync(path.join(__dirname,"../worker.js"),"utf8");
 assert.match(worker,/const \{recoverInterruptedDraftTasks\}=require/);
 assert.match(worker,/recoverInterruptedDraftTasks\(\{/);
 assert.match(worker,/recoveredDraftTasks=draftRecovery\.recovered/);
 assert.match(worker,/recoveredDraftTasks\n/);
 const recovery=fs.readFileSync(path.join(__dirname,"../core/agents/OrphanedDraftTaskRecovery.js"),"utf8");
 assert.doesNotMatch(recovery,/data:\{status:"TODO"/);
 assert.doesNotMatch(recovery,/\.agentRun\.create\(|ai\.ask\(|sendMail\(/);
});
