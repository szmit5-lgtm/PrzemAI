"use strict";
const crypto=require("node:crypto");
const prisma=require("../../lib/prisma");
const {sendTelegramMessage}=require("./TelegramBridgeService");

const NOTIFICATION_TYPE="TELEGRAM_TASK_NOTIFICATION";
const MAX_PER_TICK=12;
const MAX_TEXT_LENGTH=2800;

function notificationId(task) {
  // Versioned by terminal task update, so a later follow-up can notify again.
  const key=String(task.id)+":"+new Date(task.updatedAt).toISOString()+":"+task.status;
  return "tgn-"+crypto.createHash("sha256").update(key).digest("hex");
}
function formatNotification(task) {
  const key=String(task.metadata?.agentKey||"agent").slice(0,35);
  const title=String(task.title||"Zlecenie").slice(0,160);
  if(task.status==="ERROR"){
    return "PrzemAI — zlecenie wymaga uwagi\nAgent: "+key+
      "\nTemat: "+title+"\nStatus: Błąd. Sprawdź szczegóły zlecenia w PrzemAI.\nID: "+task.id;
  }
  const result=String(task.metadata?.result||"").trim();
  return ("PrzemAI — zadanie zakończone\nAgent: "+key+"\nTemat: "+title+
    "\n\n"+(result?result.slice(0,MAX_TEXT_LENGTH):"Wynik jest dostępny w PrzemAI.")+
    (result.length>MAX_TEXT_LENGTH?"\n\nPełny wynik: /wynik "+task.id+" 1":"")+
    "\n\nID: "+task.id).slice(0,3900);
}

// At-most-once delivery: a durable unique claim is saved before the external
// send. Uncertain network delivery is intentionally NOT retried automatically,
// avoiding duplicate messages. Failed attempts remain auditable.
async function notifyCompletedTelegramTasks({db=prisma,send=sendTelegramMessage,now=new Date(),
  enabled=process.env.TELEGRAM_NOTIFICATIONS_ENABLED==="true"}={}) {
  if(!enabled)return {status:"DISABLED",sent:0};
  const tasks=await db.task.findMany({
    where:{source:"AGENT",status:{in:["DONE","ERROR"]},
      metadata:{path:["dispatchOrigin"],equals:"TELEGRAM"}},
    orderBy:{updatedAt:"desc"},take:100,
    select:{id:true,userId:true,title:true,status:true,updatedAt:true,metadata:true}
  });
  let sent=0,claimed=0;
  for(const task of tasks){
    if(claimed>=MAX_PER_TICK)break;
    if(!task.updatedAt||!task.userId)continue;
    const id=notificationId(task);
    // Check before claiming to avoid repeated work from the first 100 tasks.
    const prior=await db.history.findUnique({where:{id},select:{id:true}});
    if(prior)continue;
    const binding=await db.history.findFirst({
      where:{userId:task.userId,type:"TELEGRAM_LINK",
        report:{path:["status"],equals:"LINKED"}},
      orderBy:{updatedAt:"desc"},select:{report:true}
    });
    const telegramUserId=binding?.report?.telegramUserId;
    if(!/^\d{1,20}$/.test(String(telegramUserId||"")))continue;
    const chatId=Number(telegramUserId);
    if(!Number.isSafeInteger(chatId)||chatId<=0)continue;

    try{
      await db.history.create({data:{
        id,userId:task.userId,type:NOTIFICATION_TYPE,title:"Telegram: wynik zadania",
        filename:"",report:{status:"SENDING",taskId:task.id,telegramUserId,
          terminalStatus:task.status,claimedAt:now.toISOString()}
      }});
    }catch(err){
      if(err?.code==="P2002")continue;
      throw err;
    }
    claimed++;
    try{
      await send({chatId,text:formatNotification(task)});
      sent++;
      await db.history.updateMany({where:{id,userId:task.userId},
        data:{report:{status:"SENT",taskId:task.id,telegramUserId,
          terminalStatus:task.status,claimedAt:now.toISOString(),sentAt:new Date().toISOString()}}});
    }catch(err){
      // Do not re-deliver a possibly accepted Telegram request.
      await db.history.updateMany({where:{id,userId:task.userId},
        data:{report:{status:"SEND_UNCONFIRMED",taskId:task.id,telegramUserId,
          terminalStatus:task.status,claimedAt:now.toISOString()}}}).catch(()=>{});
      console.error("[TelegramNotifications] Send unconfirmed",task.id,err?.name||"Error");
    }
  }
  return{status:"OK",sent,claimed};
}
module.exports={notifyCompletedTelegramTasks,notificationId,formatNotification};
