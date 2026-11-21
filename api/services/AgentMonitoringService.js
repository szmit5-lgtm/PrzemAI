"use strict";
const prisma=require("../../lib/prisma");
const MAX_OPEN_ITEMS=120;
const MAX_RUNS=3;

function meaningfulDate(value){
 if(!value)return null;
 const date=new Date(value);
 return Number.isFinite(date.getTime())?date.toISOString():null;
}
function auditStatus(agent,now){
 if(!agent.enabled)return "DISABLED";
 if(agent.status==="RUNNING")return "RUNNING";
 const latest=agent.runs?.[0]||null;
 if(agent.status==="ERROR"||latest?.status==="FAILED")return "ATTENTION";
 const next=agent.nextRunAt?new Date(agent.nextRunAt):null;
 if(next&&Number.isFinite(next.getTime())&&now.getTime()-next.getTime()>30*60000)
  return "OVERDUE";
 if(!agent.lastRunAt&&!latest)return "NO_RUNS";
 return "READY";
}
function summarizeAgentState(agents,counts,openTasks,now){
 const known=new Map(agents.map(agent=>[agent.key,agent]));
 const safeItems=openTasks.slice(0,MAX_OPEN_ITEMS).map(task=>{
  const raw=task.metadata;
  const agentKey=raw&&typeof raw==="object"&&!Array.isArray(raw)&&
   typeof raw.agentKey==="string"&&known.has(raw.agentKey)?raw.agentKey:null;
  return {
   id:task.id,title:String(task.title||"").slice(0,130),status:task.status,
   agentKey,createdAt:meaningfulDate(task.createdAt),
   updatedAt:meaningfulDate(task.updatedAt),
   startedAt:meaningfulDate(task.startedAt)
  };
 });
 const openByKey=new Map();
 for(const item of safeItems){
  if(!item.agentKey)continue;
  const count=openByKey.get(item.agentKey)||{queued:0,working:0,failed:0};
  if(item.status==="TODO")count.queued++;
  else if(item.status==="IN_PROGRESS")count.working++;
  else if(item.status==="ERROR")count.failed++;
  openByKey.set(item.agentKey,count);
 }
 const totals={queued:0,working:0,completed:0,failed:0};
 for(const row of counts){
  const amount=Number(row._count?._all||0);
  if(!Number.isSafeInteger(amount)||amount<0)continue;
  if(row.status==="TODO")totals.queued+=amount;
  else if(row.status==="IN_PROGRESS")totals.working+=amount;
  else if(row.status==="DONE")totals.completed+=amount;
  else if(row.status==="ERROR")totals.failed+=amount;
 }
 const rows=agents.map(agent=>{
  const state=auditStatus(agent,now),latest=agent.runs?.[0]||null;
  return {
   id:agent.id,key:agent.key,name:agent.name,
   enabled:agent.enabled,state,agentStatus:agent.status,
   intervalMinutes:agent.intervalMinutes,
   lastRunAt:meaningfulDate(agent.lastRunAt),
   nextRunAt:meaningfulDate(agent.nextRunAt),
   lastRun:latest?{
    status:latest.status,trigger:latest.trigger,
    startedAt:meaningfulDate(latest.startedAt),
    finishedAt:meaningfulDate(latest.finishedAt),
    // Never expose upstream exception strings from agent audit logs.
    failure:latest.status==="FAILED",
    summary:latest.status==="SUCCESS"?String(latest.summary||"").slice(0,350):null
   }:null,
   observedOpenItems:openByKey.get(agent.key)||{queued:0,working:0,failed:0}
  };
 });
 return {source:"PERSISTED_AGENT_AUDIT",checkedAt:now.toISOString(),
  totals,agents:rows,openItems:safeItems,
  truncated:openTasks.length>MAX_OPEN_ITEMS,
  note:"To stan utrwalony w bazie, nie gwarancja dostępności 24/7. Liczniki wszystkich zleceń są dokładne; lista otwartych spraw jest ograniczona do 120 najnowszych i może być niepełna."};
}

class AgentMonitoringService{
 constructor({db=prisma,now=()=>new Date()}={}){this.db=db;this.now=now;}
 async report(userId){
  if(typeof userId!=="string"||!userId.trim()||userId!==userId.trim())
   throw Object.assign(new Error("Wymagane zalogowanie."),{status:401});
  const [agents,counts,openTasks]=await Promise.all([
   this.db.agent.findMany({
    where:{userId},
    select:{id:true,key:true,name:true,enabled:true,status:true,intervalMinutes:true,
     lastRunAt:true,nextRunAt:true,runs:{
      select:{status:true,trigger:true,startedAt:true,finishedAt:true,summary:true},
      orderBy:{startedAt:"desc"},take:MAX_RUNS
     }},
    orderBy:[{name:"asc"},{id:"asc"}],take:100
   }),
   this.db.task.groupBy({
    by:["status"],where:{userId,source:"AGENT"},_count:{_all:true}
   }),
   this.db.task.findMany({
    where:{userId,source:"AGENT",status:{in:["TODO","IN_PROGRESS","ERROR"]}},
    orderBy:[{updatedAt:"desc"},{id:"desc"}],
    select:{id:true,title:true,status:true,metadata:true,
     createdAt:true,updatedAt:true,startedAt:true},
    take:MAX_OPEN_ITEMS+1
   })
  ]);
  return summarizeAgentState(agents,counts,openTasks,this.now());
 }
}
module.exports={AgentMonitoringService,summarizeAgentState,auditStatus};
