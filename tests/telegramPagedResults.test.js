"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {handleCommand}=require("../api/services/TelegramBridgeService");
const {formatNotification}=require("../api/services/TelegramTaskNotifications");

const ID="cmws0bgef0001ob0xkssl3j9b";
function update(text){return{message:{text,chat:{type:"private",id:1234},from:{id:1234}}};}
function dbWithTask(task){
 return {
   history:{findFirst:async()=>({userId:"owner",report:{status:"LINKED",telegramUserId:"1234"}})},
   task:{findFirst:async({where})=>{
     assert.equal(where.userId,"owner");
     assert.equal(where.id,ID);
     assert.equal(where.source,"AGENT");
     return task;
   }}
 };
}
const task={id:ID,userId:"owner",title:"Raport Mielna",status:"DONE",
 metadata:{dispatchOrigin:"TELEGRAM",result:"a".repeat(3200)+"KONIEC"}};
test("/wynik pages do not lose content",async()=>{
 const db=dbWithTask(task);
 const first=await handleCommand({db,update:update("/wynik "+ID)});
 const second=await handleCommand({db,update:update("/wynik "+ID+" 2")});
 assert.match(first.text,/Strona 1\/2/);
 assert.match(first.text,/Dalej: \/wynik/);
 assert.match(second.text,/Strona 2\/2/);
 assert.match(second.text,/KONIEC/);
 assert.ok(first.text.length<3900 && second.text.length<3900);
 assert.equal(first.text.includes("\\nStrona"),false);
});
test("/wynik does not return another user's or non-Telegram task",async()=>{
 const missing=await handleCommand({db:dbWithTask(null),update:update("/wynik "+ID)});
 assert.match(missing.text,/Nie znaleziono/);
 const other=await handleCommand({db:dbWithTask({...task,metadata:{result:"SECRET"}}),update:update("/wynik "+ID)});
 assert.match(other.text,/Nie znaleziono/);
 assert.doesNotMatch(other.text,/SECRET/);
});
test("/wynik rejects page overflow and running tasks",async()=>{
 const db=dbWithTask(task);
 const missing=await handleCommand({db,update:update("/wynik "+ID+" 3")});
 assert.match(missing.text,/2 stron/);
 const running=await handleCommand({db:dbWithTask({...task,status:"IN_PROGRESS"}),update:update("/wynik "+ID)});
 assert.match(running.text,/jeszcze w toku/);
});
test("long notification tells user how to retrieve complete result",()=>{
 const text=formatNotification({...task,updatedAt:new Date()});
 assert.match(text,new RegExp("/wynik "+ID));
});
