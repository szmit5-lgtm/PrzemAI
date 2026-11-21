"use strict";
const {createHash}=require("node:crypto");
const MAX_PREVIEW=600;
const MAX_SUBJECT=240;
const DAY=86400000;
function normalize(value){
 return String(value||"").normalize("NFKD").replace(/[\u0300-\u036f]/g,"")
  .replace(/ł/g,"l").replace(/Ł/g,"L").toLowerCase().replace(/\s+/g," ").trim();
}
function classifyMailAlert(message,{now=new Date(),maxAgeDays=14}={}){
 const receivedDate=new Date(message?.date||"");
 const receivedMs=receivedDate.getTime(),currentMs=new Date(now).getTime();
 if(!Number.isFinite(receivedMs)||!Number.isFinite(currentMs)||
  receivedMs>currentMs+5*60000||
  receivedMs<currentMs-maxAgeDays*DAY)return null;
 const subject=String(message?.subject||"").slice(0,MAX_SUBJECT).trim();
 const preview=String(message?.preview||"").replace(/\0/g,"")
  .replace(/\s+/g," ").slice(0,MAX_PREVIEW).trim();
 const input=normalize(subject+" "+preview);
 let category=null,priority=null;
 if(/przedsadowe wezwanie|ostateczne wezwanie|wezwanie do zaplaty|nakaz zaplaty|zawiadomienie o egzekucji|komornik|postepowanie windykacyjne/.test(input)){
  category="PAYMENT_DEMAND";priority="HIGH";
 }else if(/przeterminowana faktura|zalegla platnosc|zaleglosci w platnosciach|przypomnienie o platnosci|ponaglenie platnosci|brak wplaty|nieotrzyman[ae] platnos|niezaplacon/.test(input)){
  category="PAYMENT_REMINDER";priority="MEDIUM";
 }else if(/termin do (zlozenia|podpisania|uzupelnienia)|pilne dzialanie|ostateczny termin|wypowiedzenie umowy|odstapienie od umowy/.test(input)){
  category="DEADLINE_OR_CONTRACT";priority="MEDIUM";
 }
 if(!category)return null;
 const from=String(message?.from||"").trim().slice(0,254);
 const messageId=String(message?.messageId||"").trim().slice(0,350);
 return {category,priority,subject:subject||"(bez tematu)",
  from,receivedAt:receivedDate.toISOString(),preview,messageId,
  uid:Number.isSafeInteger(message?.uid)?message.uid:null,
  uidValidity:String(message?.uidValidity||"").slice(0,90),
  suggestedDraft:
   "Dzień dobry,\n\nDziękujemy za wiadomość. Przekazaliśmy sprawę do weryfikacji rozliczeń i dokumentacji. Po jej zakończeniu wrócimy z informacją o dalszych krokach.\n\nZ poważaniem,\nDekonica"};
}
function alertId(integrationId,message) {
 if(!integrationId)throw new Error("Brak integracji.");
 const key=String(message?.messageId||"").trim()||
  (message?.uid!=null?"uid:"+String(message.uidValidity||"unknown")+":"+String(message.uid):"");
 if(!key)throw new Error("Nie można ustalić identyfikatora wiadomości.");
 return "mailalert-"+createHash("sha256").update(JSON.stringify([
  integrationId,key
 ])).digest("hex").slice(0,50);
}
module.exports={classifyMailAlert,alertId};
