"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {notifyCompletedTelegramTasks,notificationId,formatNotification}=
  require("../api/services/TelegramTaskNotifications");

const makeTask=()=>({
 id:"task-a",userId:"owner-1",title:"Raport Mielna",status:"DONE",
 updatedAt:new Date("2026-11-22T15:00:00.000Z"),
 metadata:{dispatchOrigin:"TELEGRAM",agentKey:"construction",result:"Gotowe: plan odbioru"}
});
test("notifications are opt-in and do not touch database when disabled",async()=>{
 const report=await notifyCompletedTelegramTasks({enabled:false,db:{task:{findMany(){throw Error("unexpected")}}}});
 assert.equal(report.status,"DISABLED");
});
test("only one durable claim per task result and private linked user",async()=>{
 const task=makeTask(), records=new Map(), sent=[];
 const db={
  task:{findMany:async({where})=>{
   assert.equal(where.metadata.path[0],"dispatchOrigin");
   assert.equal(where.metadata.equals,"TELEGRAM");return[task];
  }},
  history:{
   findUnique:async({where})=>records.has(where.id)?{id:where.id}:null,
   findFirst:async({where})=>{
     assert.equal(where.userId,"owner-1");
     return{report:{status:"LINKED",telegramUserId:"12345"}};
   },
   create:async({data})=>{
     if(records.has(data.id))throw Object.assign(Error("duplicate"),{code:"P2002"});
     records.set(data.id,data);
   },
   updateMany:async({where,data})=>{
     records.set(where.id,{...records.get(where.id),...data});
     return{count:1};
   }
  }
 };
 const send=async x=>sent.push(x);
 const one=await notifyCompletedTelegramTasks({db,send,enabled:true});
 const two=await notifyCompletedTelegramTasks({db,send,enabled:true});
 assert.equal(one.sent,1);assert.equal(two.sent,0);
 assert.equal(sent[0].chatId,12345);
 assert.match(sent[0].text,/Gotowe: plan odbioru/);
 assert.equal(records.get(notificationId(task)).report.status,"SENT");
});
test("unconfirmed send is not automatically repeated",async()=>{
 const t=makeTask(),records=new Map(),oldError=console.error;
 console.error=()=>{};
 try {
  const db={task:{findMany:async()=>[t]},history:{
   findUnique:async({where})=>records.has(where.id)?{id:where.id}:null,
   findFirst:async()=>({report:{telegramUserId:"12345"}}),
   create:async({data})=>{records.set(data.id,data);},
   updateMany:async({where,data})=>{records.set(where.id,{...records.get(where.id),...data});}
  }};
  let attempts=0;
  await notifyCompletedTelegramTasks({db,enabled:true,send:async()=>{attempts++;throw Error("network");}});
  await notifyCompletedTelegramTasks({db,enabled:true,send:async()=>{attempts++;}});
  assert.equal(attempts,1);
  assert.equal(records.get(notificationId(t)).report.status,"SEND_UNCONFIRMED");
 }finally{console.error=oldError;}
});
test("a later completed follow-up gets a different notification id",()=>{
 const first=makeTask(),next={...first,updatedAt:new Date("2026-11-22T16:00:00.000Z")};
 assert.notEqual(notificationId(first),notificationId(next));
 assert.match(formatNotification({...first,status:"ERROR"}),/Błąd/);
});
