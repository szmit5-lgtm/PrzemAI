"use strict";
const net = require("node:net");
const tls = require("node:tls");
const prisma = require("../lib/prisma");

const taskId = "specpoz-office-email-20261112-075837";
const from = "office@dekonica.com";
const to = "biuro@specpoz.eu";
const subject = "Re: Wezwanie do zapłaty – Przedszkole w Mielnie";
const body = [
"Dzień dobry Panie Romanie,",
"",
"Dziękuję za przesłaną wiadomość.",
"",
"Jeżeli wezwanie dotyczy wykonania zabezpieczeń dymoszczelnych na inwestycji w Mielnie, chciałbym uprzejmie poinformować, że zakwestionowaliśmy zasadność obciążenia naszej firmy kosztami tych prac.",
"",
"Przedstawiliśmy już nasze stanowisko w korespondencji z Unihouse i obecnie oczekujemy na wyjaśnienie oraz rozstrzygnięcie tej kwestii.",
"",
"Jeżeli natomiast przesłane wezwanie dotyczy innej sprawy, będę wdzięczny za doprecyzowanie, jakiego zakresu prac i zobowiązania dotyczy, abyśmy mogli odpowiednio się do niego odnieść.",
"",
"Dziękuję za zrozumienie i pozdrawiam serdecznie,",
"",
"Przemysław Szmitkowski"
].join("\r\n");

function mimeWord(value) { return "=?UTF-8?B?" + Buffer.from(value,"utf8").toString("base64") + "?="; }
function smtpMessage() {
  const encoded = Buffer.from(body,"utf8").toString("base64").match(/.{1,76}/g).join("\r\n");
  return [
    "From: " + from,
    "To: " + to,
    "Subject: " + mimeWord(subject),
    "Date: " + new Date().toUTCString(),
    "Message-ID: <" + taskId + "@dekonica.com>",
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    encoded
  ].join("\r\n");
}
async function sendSmtp(host,port,password) {
  let socket = port === 465
    ? tls.connect({host,port,servername:host,rejectUnauthorized:true})
    : net.connect({host,port});
  socket.setTimeout(20000,()=>socket.destroy(new Error("timeout")));
  let buffer = "";
  let pending = [];
  let closedError = null;
  socket.on("data", chunk => { buffer += chunk.toString("utf8"); while (buffer.includes("\r\n")) {
    const end = buffer.indexOf("\r\n"); const line = buffer.slice(0,end); buffer = buffer.slice(end+2);
    pending.push(line); if (notify) notify();
  }});
  let notify = null;
  socket.on("error",e=>{ closedError=e; if(notify)notify(); });
  socket.on("close",()=>{ if(!closedError)closedError=new Error("socket closed"); if(notify)notify(); });
  async function line() {
    while(!pending.length) {
      if(closedError)throw closedError;
      await new Promise(r=>{notify=r;});
      notify=null;
    }
    return pending.shift();
  }
  async function reply(expected) {
    let code;
    while(true) {
      const l=await line();
      if(!/^\d{3}[ -]/.test(l)) throw Error("invalid SMTP reply");
      code=Number(l.slice(0,3));
      if(l[3]===" ") break;
    }
    if(!expected.includes(code))throw Error("SMTP code "+code);
  }
  const write = value => socket.write(value+"\r\n");
  try {
    if(port===465)await new Promise((resolve,reject)=>{socket.once("secureConnect",resolve);socket.once("error",reject);});
    else await new Promise((resolve,reject)=>{socket.once("connect",resolve);socket.once("error",reject);});
    await reply([220]);
    write("EHLO przemai.dekonica.com");await reply([250]);
    if(port===587) {
      write("STARTTLS");await reply([220]);
      const upgraded=tls.connect({socket,servername:host,rejectUnauthorized:true});
      await new Promise((resolve,reject)=>{upgraded.once("secureConnect",resolve);upgraded.once("error",reject);});
      socket=upgraded;
      write("EHLO przemai.dekonica.com");await reply([250]);
    }
    write("AUTH LOGIN");await reply([334]);
    write(Buffer.from(from).toString("base64"));await reply([334]);
    write(Buffer.from(password).toString("base64"));await reply([235]);
    write("MAIL FROM:<"+from+">");await reply([250]);
    write("RCPT TO:<"+to+">");await reply([250,251]);
    write("DATA");await reply([354]);
    socket.write(smtpMessage()+"\r\n.\r\n");
    await reply([250]);
    write("QUIT");
    return true;
  } finally { socket.destroy(); }
}

module.exports = async function sendSpecpozOnce() {
  if (process.env.DEKONICA_SPECPOZ_SEND_ONCE !== "true") return;
  const owner = process.env.DEKONICA_MAIL_OWNER_USER_ID;
  const password = process.env.DEKONICA_MAIL_PASSWORD;
  if(!owner || !password) {console.warn("[SPECPOZ-SEND] SKIPPED missing owner/credential");return;}
  // Claim a deterministic unique ID before SMTP. Multiple rolling deployments cannot double-send.
  try {
    await prisma.task.create({data:{id:taskId,userId:owner,source:"MAIL",title:"SPECPOZ – wysyłka wyjaśnienia",description:subject,status:"IN_PROGRESS",priority:"MEDIUM",tags:["mail","specpoz"],metadata:{from,to,subject,attemptedAt:new Date().toISOString()}}});
  } catch(e) {
    if(e.code==="P2002") {console.log("[SPECPOZ-SEND] SKIPPED duplicate attempt");return;}
    console.warn("[SPECPOZ-SEND] BLOCKED cannot establish idempotency claim");return;
  }
  let success=false;
  for(const [host,port] of [["dekonica.com",465],["dekonica.com",587]]) {
    try { await sendSmtp(host,port,password);success=true;break; }
    catch(e) {console.warn("[SPECPOZ-SEND] SMTP attempt failed port="+port+" code="+String(e.message).slice(0,40));}
  }
  try {
    await prisma.task.update({where:{id:taskId},data:{status:success?"DONE":"ERROR",completedAt:success?new Date():null,metadata:{from,to,subject,result:success?"SMTP_ACCEPTED":"FAILED",checkedAt:new Date().toISOString()}}});
  } catch(e) {console.warn("[SPECPOZ-SEND] audit update failed");}
  console.log("[SPECPOZ-SEND] RESULT="+(success?"SMTP_ACCEPTED":"FAILED"));
};
