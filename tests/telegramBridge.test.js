"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {createLink,handleCommand,validWebhookSecret}=require("../api/services/TelegramBridgeService");

test("Telegram rejects missing or invalid webhook secret",()=>{
  assert.equal(validWebhookSecret(null,"strong-secret-long-enough"),false);
  assert.equal(validWebhookSecret("bad","strong-secret-long-enough"),false);
  assert.equal(validWebhookSecret("strong-secret-long-enough","strong-secret-long-enough"),true);
});
test("Pairing code belongs to logged in user and expires",async()=>{
  let record;
  const db={history:{create:async x=>{record=x.data;}}};
  const result=await createLink({userId:"user-1",db,now:new Date("2026-11-22T12:00:00Z")});
  assert.equal(record.userId,"user-1");
  assert.equal(record.report.status,"PENDING");
  assert.equal(record.id,result.code);
  assert.equal(result.expiresAt,"2026-11-22T12:10:00.000Z");
});
test("Telegram ignores group messages without reading user data",async()=>{
  const db={history:{findFirst:()=>{throw Error("must not query database");}}};
  const answer=await handleCommand({update:{message:{text:"/status",chat:{type:"group",id:-3},from:{id:3}}},db});
  assert.equal(answer,null);
});
test("Unpaired Telegram account cannot read tasks or queue work",async()=>{
  const db={history:{findFirst:async()=>null},task:{groupBy:()=>{throw Error("must not query");}}};
  const answer=await handleCommand({update:{message:{text:"/status",chat:{type:"private",id:42},from:{id:42}}},db});
  assert.match(answer.text,/Najpierw/);
});
test("Idempotent Telegram command writes only user scoped queued work",async()=>{
  const events=[],tasks=[];
  const db={
    history:{findFirst:async()=>({userId:"owner",report:{status:"LINKED"}})},
    $transaction:async(fn)=>fn({
      history:{create:async({data})=>{events.push(data);}},
      agent:{findFirst:async({where})=>{assert.equal(where.userId,"owner");return{id:"agent-1"};},
        updateMany:async()=>({count:1})},
      task:{create:async({data})=>{tasks.push(data);return{id:"task-1"};}}
    })
  };
  const update={update_id:123,message:{text:"/zadanie construction Przygotuj raport Mielna",chat:{type:"private",id:99},from:{id:99}}};
  const answer=await handleCommand({update,db});
  assert.match(answer.text,/Przyjeto/);
  assert.equal(tasks.length,1);
  assert.equal(tasks[0].userId,"owner");
  assert.equal(tasks[0].status,"TODO");
  assert.equal(tasks[0].metadata.dispatchOrigin,"TELEGRAM");
  assert.equal(events[0].userId,"owner");
});
