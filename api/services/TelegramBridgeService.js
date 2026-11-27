"use strict";
const crypto = require("node:crypto");
const prisma = require("../../lib/prisma");
const { handleChat } = require("./TelegramChatService");
const { getAgentDefinition } = require("../../lib/agentCatalog");

const LINK_TYPE = "TELEGRAM_LINK";
const EVENT_TYPE = "TELEGRAM_EVENT";
const MAX_AGE_MS = 10 * 60 * 1000;
const BOT_COMMANDS = "Komendy: /spolka [identyfikator|-], /status, /zadanie <agent> <polecenie>, /wynik <ID> [strona]. Przyklad: /wynik cmws0bgef0001ob0xkssl3j9b 2.";
function code() { return crypto.randomUUID(); }

async function createLink({ userId, db = prisma, now = new Date() }) {
  if (!userId) throw Error("UNAUTHORIZED");
  const linkCode = code();
  await db.history.create({data:{
    id:linkCode, userId, title:"Telegram: powiazanie konta",
    filename:"", type: LINK_TYPE,
    report:{ status:"PENDING", expiresAt:new Date(now.getTime()+MAX_AGE_MS).toISOString() }
  }});
  return { code:linkCode, expiresAt:new Date(now.getTime()+MAX_AGE_MS).toISOString() };
}
async function findBinding(db, telegramUserId) {
  return db.history.findFirst({
    where:{type:LINK_TYPE, report:{path:["telegramUserId"],equals:String(telegramUserId)}},
    select:{userId:true,report:true},orderBy:{updatedAt:"desc"}
  });
}
async function handleCommand({ update, db = prisma, now = new Date(),
  chat = (...args) => require("./ChatService").chat(...args) }) {
  const msg = update?.message;
  if (!msg || typeof msg.text !== "string" || msg.chat?.type !== "private" ||
      !Number.isSafeInteger(msg.from?.id) || msg.from.id <= 0 || msg.from.is_bot === true ||
      msg.chat?.id !== msg.from.id)
    return null;
  const telegramUserId = String(msg.from.id), text = msg.text.trim();
  if (!text) return null;
  if (text.startsWith("/start ")) {
    const match = /^\/start\s+([0-9a-f]{8}-[0-9a-f-]{27,})$/.exec(text);
    if (!match) return {chatId:msg.chat.id, text:"Nieprawidlowy kod laczenia."};
    const id=match[1];
    const candidate=await db.history.findFirst({where:{id,type:LINK_TYPE},select:{userId:true,report:true}});
    if (!candidate || candidate.report?.status!=="PENDING" ||
        !candidate.report?.expiresAt || new Date(candidate.report.expiresAt)<=now)
      return {chatId:msg.chat.id,text:"Kod wygasl lub zostal wykorzystany. Wygeneruj nowy w PrzemAI."};
    const existing = await findBinding(db,telegramUserId);
    if (existing && existing.userId!==candidate.userId)
      return {chatId:msg.chat.id,text:"To konto Telegram jest juz powiazane z innym uzytkownikiem."};
    const claimed=await db.history.updateMany({
      where:{id,type:LINK_TYPE,report:{path:["status"],equals:"PENDING"}},
      data:{report:{status:"LINKED",telegramUserId,linkedAt:now.toISOString(),expiresAt:candidate.report.expiresAt}}
    });
    return {chatId:msg.chat.id,text:claimed.count===1?"Polaczono Telegram z kontem PrzemAI. "+BOT_COMMANDS:"Kod zostal juz wykorzystany."};
  }
  const binding=await findBinding(db,telegramUserId);
  if (!binding || binding.report?.status!=="LINKED")
    return {chatId:msg.chat.id,text:"Najpierw polacz konto Telegram z PrzemAI za pomoca jednorazowego kodu."};
  if (text==="/start" || text==="/help")
    return {chatId:msg.chat.id,text:BOT_COMMANDS};
  if (text==="/status") {
    const counts=await db.task.groupBy({by:["status"],where:{userId:binding.userId,source:"AGENT"},_count:{_all:true}});
    const summary=counts.map(x=>x.status+": "+x._count._all).join(", ")||"brak zlecen";
    return {chatId:msg.chat.id,text:"PrzemAI — zadania: "+summary};
  }
  if (text==="/wynik" || text.startsWith("/wynik ")) {
    const m=/^\/wynik\s+([a-z0-9_-]{12,80})(?:\s+(\d{1,3}))?$/.exec(text);
    if(!m) return {chatId:msg.chat.id,text:"Uzyj: /wynik <ID zadania> [numer strony]."};
    const id=m[1],page=Number(m[2]||"1");
    if(page<1||page>100)return {chatId:msg.chat.id,text:"Strona musi byc od 1 do 100."};
    const task=await db.task.findFirst({
      where:{id,userId:binding.userId,source:"AGENT"},
      select:{id:true,title:true,status:true,metadata:true}
    });
    if(!task || task.metadata?.dispatchOrigin!=="TELEGRAM")
      return {chatId:msg.chat.id,text:"Nie znaleziono Twojego zlecenia Telegram."};
    if(task.status!=="DONE" && task.status!=="ERROR")
      return {chatId:msg.chat.id,text:"Zlecenie jest jeszcze w toku. Status: "+task.status+"."};
    if(task.status==="ERROR")
      return {chatId:msg.chat.id,text:"Zlecenie zakonczylo sie bledem. Sprawdz je w PrzemAI. ID: "+task.id};
    const full=String(task.metadata?.result||"");
    if(!full.trim())return {chatId:msg.chat.id,text:"Brak zapisanego wyniku dla tego zlecenia."};
    const size=3000;
    const pages=Math.ceil(full.length/size);
    if(page>pages)return {chatId:msg.chat.id,text:"Raport ma "+pages+" stron. Uzyj /wynik "+id+" "+pages+"."};
    const chunk=full.slice((page-1)*size,page*size);
    const heading="PrzemAI — raport: "+String(task.title||"Zlecenie").slice(0,110)+
      "\nStrona "+page+"/"+pages+"\n\n";
    const footer=page<pages?"\n\nDalej: /wynik "+id+" "+(page+1):"\n\nKoniec raportu.";
    return {chatId:msg.chat.id,text:heading+chunk+footer};
  }
  if (text.startsWith("/zadanie ")) {
    const m=/^\/zadanie\s+([a-z]+)\s+([\s\S]+)$/.exec(text);
    const key=m?.[1],instruction=m?.[2]?.trim();
    const def=getAgentDefinition(key);
    if(!def || def.mode!=="TASK_DRAFT" || !instruction || instruction.length<5 || instruction.length>4000)
      return {chatId:msg.chat.id,text:"Podaj: /zadanie <agent> <polecenie> (5–4000 znakow)."};
    if(!Number.isSafeInteger(update.update_id) || update.update_id<0)
      return {chatId:msg.chat.id,text:"Nie mozna potwierdzic identyfikatora wiadomosci."};
    const eventId="tg-"+crypto.createHash("sha256").update(String(update.update_id)).digest("hex");
    try {
      const task=await db.$transaction(async tx=>{
        await tx.history.create({data:{id:eventId,userId:binding.userId,type:EVENT_TYPE,
          title:"Telegram command",filename:"",report:{telegramUserId,updateId:update.update_id}}});
        const agent=await tx.agent.findFirst({where:{userId:binding.userId,key,enabled:true},select:{id:true}});
        if(!agent) throw Error("AGENT_NOT_ENABLED");
        const item=await tx.task.create({data:{
          userId:binding.userId,source:"AGENT",priority:"MEDIUM",status:"TODO",
          title:instruction.replace(/\s+/g," ").slice(0,110),description:instruction,tags:[key],
          metadata:{agentKey:key,dispatchOrigin:"TELEGRAM",resultStatus:"QUEUED",
            submittedAt:now.toISOString()}
        },select:{id:true}});
        await tx.agent.updateMany({
          where:{id:agent.id,userId:binding.userId,enabled:true,NOT:{status:"RUNNING"}},
          data:{nextRunAt:now,status:"IDLE"}
        });
        return item;
      });
      return {chatId:msg.chat.id,text:"Przyjeto zlecenie ("+key+"). ID: "+task.id+". Sprawdz /status."};
    } catch(err) {
      if (err?.code==="P2002") return {chatId:msg.chat.id,text:"Zlecenie z tej wiadomosci zostalo juz przyjete."};
      if(err?.message==="AGENT_NOT_ENABLED") return {chatId:msg.chat.id,text:"Ten agent nie jest aktywny."};
      throw err;
    }
  }
  if (text.startsWith("/") && !/^\/(?:spolka|watek)(?:\s|$)/.test(text))
    return {chatId:msg.chat.id,text:BOT_COMMANDS};
  const answer = await handleChat({
    db, msg, text, userId: binding.userId, telegramUserId, chat,
    isStillLinked: async () => {
      const current = await findBinding(db, telegramUserId);
      return current?.userId === binding.userId && current.report?.status === "LINKED";
    }
  });
  return answer ? { chatId: msg.chat.id, text: answer } : null;
}

async function sendTelegramMessage({chatId,text,token=process.env.TELEGRAM_TOKEN,fetchFn=fetch}) {
  if(!token) throw Error("TELEGRAM_TOKEN_NOT_SET");
  let remaining = String(text);
  while (remaining.length) {
    let length = Math.min(3900, remaining.length);
    if (/[\uD800-\uDBFF]/.test(remaining[length - 1]) && length < remaining.length) length--;
    const response = await fetchFn("https://api.telegram.org/bot"+token+"/sendMessage", {
      method:"POST",headers:{"content-type":"application/json"},
      body:JSON.stringify({chat_id:chatId,text:remaining.slice(0, length)})
    });
    if (!response.ok) throw Error("Telegram API HTTP "+response.status);
    remaining = remaining.slice(length);
  }
}
function validWebhookSecret(received, expected=process.env.TELEGRAM_WEBHOOK_SECRET) {
  if(typeof expected!=="string" || expected.length<16 || typeof received!=="string") return false;
  const a=Buffer.from(received),b=Buffer.from(expected);
  return a.length===b.length && crypto.timingSafeEqual(a,b);
}
module.exports={createLink,handleCommand,sendTelegramMessage,validWebhookSecret};
