"use strict";

// Prevent a worker restart from leaving draft tasks permanently IN_PROGRESS.
// An abandoned task is marked ERROR for a human to inspect and explicitly
// retry. Never requeue it automatically: execution may already have produced
// an external read or an expensive AI response.
const {getAgentDefinition}=require("../../lib/agentCatalog");
const STALE_TASK_MS=90*60*1000;
const MAX_STALE_TASKS_PER_CYCLE=40;
const INTERRUPTION="Praca agenta została przerwana albo utracono potwierdzenie wykonania. Sprawdź zlecenie i w razie potrzeby użyj „Ponów zadanie”.";

function isDraftTask(task){
 const key=task?.metadata?.agentKey;
 return typeof key==="string"&&Boolean(key.trim())&&
  getAgentDefinition(key)?.mode==="TASK_DRAFT";
}

async function recoverInterruptedDraftTasks({
 db,ownerScope=null,now=()=>new Date(),shouldStop=()=>false
}={}){
 if(!db?.task?.findMany||!db?.task?.updateMany||!db?.agent?.findFirst)
  throw Error("Brak repozytorium zleceń i agentów.");
 const cutoff=new Date(now().getTime()-STALE_TASK_MS);
 const stale=await db.task.findMany({
  where:{
   source:"AGENT",status:"IN_PROGRESS",
   startedAt:{lt:cutoff},updatedAt:{lt:cutoff},
   ...(ownerScope?{userId:ownerScope}:{})
  },
  orderBy:[{updatedAt:"asc"},{id:"asc"}],
  select:{id:true,userId:true,startedAt:true,updatedAt:true,metadata:true},
  take:MAX_STALE_TASKS_PER_CYCLE
 });
 let recovered=0,active=0,skipped=0;
 for(const task of stale){
  if(shouldStop())break;
  if(!isDraftTask(task)){skipped++;continue;}
  const key=task.metadata.agentKey;
  // Long-running tasks can be legitimate. A recently heartbeating
  // RUNNING agent owns its work even when task.startedAt is old.
  const agent=await db.agent.findFirst({
   where:{userId:task.userId,key},
   select:{id:true,status:true,updatedAt:true}
  });
  if(agent?.status==="RUNNING"&&new Date(agent.updatedAt)>=cutoff){
   active++;continue;
  }
  if(shouldStop())break;
  const m=task.metadata&&typeof task.metadata==="object"&&!Array.isArray(task.metadata)
   ?task.metadata:{};
  const updated=await db.task.updateMany({
   where:{
    id:task.id,userId:task.userId,source:"AGENT",
    status:"IN_PROGRESS",
    startedAt:task.startedAt,updatedAt:task.updatedAt,
    metadata:{path:["agentKey"],equals:key}
   },
   data:{status:"ERROR",
    metadata:{...m,resultStatus:"FAILED",error:INTERRUPTION,
     interruptedAt:now().toISOString(),recoveredByWatchdog:true}}
  });
  if(updated.count===1)recovered++;
 }
 return {examined:stale.length,recovered,active,skipped,
  truncated:stale.length>=MAX_STALE_TASKS_PER_CYCLE};
}
module.exports={recoverInterruptedDraftTasks,isDraftTask,STALE_TASK_MS,MAX_STALE_TASKS_PER_CYCLE};
