"use strict";
// Read the current Telegram configuration before registering our webhook.
// Never displace a different webhook; never expose the bot token or secret.
const DEFAULT_URL="https://api.przemai.pl/api/telegram/webhook";

async function telegramApi(method,payload,{token,fetchFn=fetch}={}){
 if(!token)throw Error("TELEGRAM_TOKEN_NOT_CONFIGURED");
 const url="https://api.telegram.org/bot"+token+"/"+method;
 const controller=new AbortController();
 const timer=setTimeout(()=>controller.abort(),10000);
 try{
  const response=await fetchFn(url,{method:"POST",headers:{"content-type":"application/json"},
    body:JSON.stringify(payload||{}),signal:controller.signal});
  if(!response.ok)throw Error("TELEGRAM_HTTP_"+response.status);
  const data=await response.json();
  if(!data?.ok)throw Error("TELEGRAM_API_REJECTED");
  return data.result;
 }finally{clearTimeout(timer);}
}

async function ensureTelegramWebhook({env=process.env,fetchFn=fetch,logger=console}={}){
 if(!env.TELEGRAM_TOKEN)return{status:"MISSING_TOKEN"};
 if(env.TELEGRAM_WEBHOOK_AUTO_REGISTER!=="true")return{status:"AUTO_REGISTER_DISABLED"};
 const expected=env.TELEGRAM_WEBHOOK_SECRET;
 if(typeof expected!=="string" || expected.length<16)return{status:"MISSING_SECRET"};
 const configuredUrl=env.TELEGRAM_WEBHOOK_URL||DEFAULT_URL;
 let url;
 try {
   const u=new URL(configuredUrl);
   if(u.protocol!=="https:"||u.hostname!=="api.przemai.pl"||
      u.pathname!=="/api/telegram/webhook"||u.username||u.password||u.search||u.hash)
     return{status:"UNEXPECTED_TARGET"};
   url=u.href;
 }catch{return{status:"UNEXPECTED_TARGET"};}
 const api=(method,payload)=>telegramApi(method,payload,{token:env.TELEGRAM_TOKEN,fetchFn});
 const info=await api("getWebhookInfo",{});
 const existing=String(info?.url||"");
 if(existing && existing!==url){
   logger.warn("[TelegramBridge] Another webhook already configured; leaving it unchanged");
   return{status:"DIFFERENT_WEBHOOK_PRESENT"};
 }
 // Existing webhook may use a different secret, but the Telegram API does
 // not reveal it. Re-register only on explicit operator request.
 if(existing===url && env.TELEGRAM_WEBHOOK_FORCE_REFRESH!=="true")
   return{status:"WEBHOOK_ALREADY_CONFIGURED"};
 await api("setWebhook",{
   url,secret_token:expected,allowed_updates:["message"],drop_pending_updates:false
 });
 logger.info("[TelegramBridge] Webhook registered for api.przemai.pl");
 return{status:"REGISTERED"};
}
module.exports={ensureTelegramWebhook,telegramApi};
