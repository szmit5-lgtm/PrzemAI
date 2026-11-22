"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {ensureTelegramWebhook}=require("../api/services/TelegramWebhookSetup");

const base={TELEGRAM_TOKEN:"fake-token",TELEGRAM_WEBHOOK_AUTO_REGISTER:"true",
 TELEGRAM_WEBHOOK_SECRET:"a_secure_secret_123456"};
function mock(info){
 const calls=[];
 const fetchFn=async(url,opts)=>{
  const method=url.split("/").pop();
  calls.push({method,body:JSON.parse(opts.body)});
  return{ok:true,json:async()=>({ok:true,result:method==="getWebhookInfo"?info:true})};
 };
 return{calls,fetchFn};
}
test("does nothing unless explicit opt-in and secret",async()=>{
 const f=mock({url:""});
 assert.equal((await ensureTelegramWebhook({env:{...base,TELEGRAM_WEBHOOK_AUTO_REGISTER:"false"},fetchFn:f.fetchFn})).status,"AUTO_REGISTER_DISABLED");
 assert.equal((await ensureTelegramWebhook({env:{...base,TELEGRAM_WEBHOOK_SECRET:""},fetchFn:f.fetchFn})).status,"MISSING_SECRET");
 assert.equal(f.calls.length,0);
});
test("does not replace a different webhook",async()=>{
 const f=mock({url:"https://old-bot.example.com/webhook"});
 const r=await ensureTelegramWebhook({env:base,fetchFn:f.fetchFn,logger:{warn(){}}});
 assert.equal(r.status,"DIFFERENT_WEBHOOK_PRESENT");
 assert.deepEqual(f.calls.map(x=>x.method),["getWebhookInfo"]);
});
test("registers only own HTTPS endpoint with secret and no updates dropped",async()=>{
 const f=mock({url:""});
 const r=await ensureTelegramWebhook({env:base,fetchFn:f.fetchFn,logger:{info(){}}});
 assert.equal(r.status,"REGISTERED");
 assert.deepEqual(f.calls.map(x=>x.method),["getWebhookInfo","setWebhook"]);
 assert.equal(f.calls[1].body.url,"https://api.przemai.pl/api/telegram/webhook");
 assert.equal(f.calls[1].body.secret_token,base.TELEGRAM_WEBHOOK_SECRET);
 assert.equal(f.calls[1].body.drop_pending_updates,false);
});
test("does not replace same webhook secret without forced refresh",async()=>{
 const f=mock({url:"https://api.przemai.pl/api/telegram/webhook"});
 const r=await ensureTelegramWebhook({env:base,fetchFn:f.fetchFn});
 assert.equal(r.status,"WEBHOOK_ALREADY_CONFIGURED");
 assert.equal(f.calls.length,1);
});
test("rejects non-PrzemAI target",async()=>{
 const f=mock({url:""});
 const r=await ensureTelegramWebhook({env:{...base,TELEGRAM_WEBHOOK_URL:"https://example.org/steal"},fetchFn:f.fetchFn});
 assert.equal(r.status,"UNEXPECTED_TARGET");
 assert.equal(f.calls.length,0);
});
