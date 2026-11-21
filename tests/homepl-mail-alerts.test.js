"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {classifyMailAlert,alertId}=require("../lib/mailAlertClassifier");
const now=new Date("2026-11-21T17:30:00Z");
const sample=(subject="Wezwanie do zapłaty",preview="Prosimy o wyjaśnienie salda")=>({
 subject,preview,from:"kontrahent@example.com",date:new Date("2026-11-20T12:00:00Z"),
 messageId:"<synthetic-msg-1@example.com>",uid:2,uidValidity:"1234"
});
test("mail alerts prioritize payment demands and prepare gentle draft without promising transfers",()=>{
 const a=classifyMailAlert(sample(),{now});
 assert.equal(a.category,"PAYMENT_DEMAND");
 assert.equal(a.priority,"HIGH");
 assert.equal(a.from,"kontrahent@example.com");
 assert.match(a.suggestedDraft,/Dziękujemy za wiadomość/);
 assert.doesNotMatch(a.suggestedDraft,/zapłacimy|przelejemy|zobowiązujemy|termin zapłaty/);
});
test("mail triage also detects reminders, contract deadlines and handles Polish diacritics",()=>{
 const reminders=classifyMailAlert(sample("Przypomnienie o płatności faktury"),{now});
 assert.equal(reminders.category,"PAYMENT_REMINDER");
 assert.equal(reminders.priority,"MEDIUM");
 const deadline=classifyMailAlert(sample("Ostateczny termin uzupełnienia dokumentów"),{now});
 assert.equal(deadline.category,"DEADLINE_OR_CONTRACT");
 const polite=classifyMailAlert(sample("Oferta sprzedaży modułów"),{now});
 assert.equal(polite,null);
});
test("mail preview alone can trigger an alert but no unsupported subject is classified",()=>{
 const x=classifyMailAlert(sample("Wiadomość", "Przesyłamy przedsądowe wezwanie do zapłaty."),{now});
 assert.equal(x.category,"PAYMENT_DEMAND");
 const normal=classifyMailAlert(sample("Wiadomość","Witamy serdecznie"),{now});
 assert.equal(normal,null);
});
test("triage excludes old or future mail; preview is bounded and no body is persisted",()=>{
 const old={...sample(),date:new Date("2026-11-01T12:00:00Z")};
 assert.equal(classifyMailAlert(old,{now}),null);
 const future={...sample(),date:new Date("2026-11-22T12:00:00Z")};
 assert.equal(classifyMailAlert(future,{now}),null);
 const big=classifyMailAlert(sample("Wezwanie do zapłaty","tekst ".repeat(1000)),{now});
 assert.ok(big.preview.length<=600);
});
test("mail alert identity is stable per mailbox message and independent per integration",()=>{
 const a=alertId("integration1",sample());
 const b=alertId("integration1",sample());
 const c=alertId("integration2",sample());
 assert.equal(a,b);
 assert.notEqual(a,c);
 assert.throws(()=>alertId("i",{}),/identyfikatora/);
});
test("mail agent is owner-gated and persists alerts without sending outgoing email",()=>{
 const financial=fs.readFileSync(path.join(__dirname,"../agents/financial/FinancialAgent.js"),"utf8");
 const connector=fs.readFileSync(path.join(__dirname,"../connectors/mail/HomePlMailConnector.js"),"utf8");
 const routes=fs.readFileSync(path.join(__dirname,"../api/routes/agentRoutes.js"),"utf8");
 const ui=fs.readFileSync(path.join(__dirname,"../frontend/src/app/agents/mail/alerts/page.js"),"utf8");
 const agentUi=fs.readFileSync(path.join(__dirname,"../frontend/src/app/agents/[key]/page.js"),"utf8");
 assert.match(financial,/canSyncMailIntegration\(userId, integration\)/);
 assert.match(financial,/classifyMailAlert\(message\)/);
 assert.match(financial,/prisma\.history\.create\(/);
 assert.match(financial,/DEKONICA_MAIL_ALERT/);
 assert.match(connector,/parsed\.text\.replace/);
 assert.match(routes,/router\.get\("\/mail\/alerts",verifyToken/);
 assert.match(routes,/where:\{userId:req\.user\.id,type:MAIL_ALERT_TYPE\}/);
 assert.match(routes,/router\.patch\("\/mail\/alerts\/:alertId\/review"/);
 assert.match(ui,/PrzemAI niczego stąd nie wysyła/);
 assert.match(agentUi,/key==="mail"&&<Link href="\/agents\/mail\/alerts"/);
 assert.doesNotMatch(financial,/smtp\.sendMail|sendMessage\(/);
});
