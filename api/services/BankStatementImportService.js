"use strict";
const crypto=require("crypto");
const prisma=require("../../lib/prisma");
const {OrganizationFinanceService}=require("./OrganizationFinanceService");
const {OrganizationError}=require("./OrganizationService");
const finance=new OrganizationFinanceService();
function money(v){
 const s=String(v??"").trim().replace(/\s/g,"").replace(",",".");
 if(!/^-?\d+(?:\.\d{1,2})?$/.test(s))throw new Error("Nieprawidłowa kwota.");
 return Number(s).toFixed(2);
}
function date(v){
 const s=String(v??"").trim();
 const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
 if(!m||!Number.isFinite(Date.parse(s+"T12:00:00Z"))||new Date(s+"T12:00:00Z").toISOString().slice(0,10)!==s)throw new Error("Data musi mieć format RRRR-MM-DD.");
 return new Date(s+"T12:00:00Z");
}
async function importStatement(userId,orgId,payload){
 await finance.accessible(userId,orgId);
 const membership=await prisma.organizationMembership.findFirst({where:{userId,organizationId:orgId,status:"ACTIVE",role:"OWNER"}});
 if(!membership)throw new OrganizationError("Import wyciągów wymaga roli właściciela firmy.",403);
 const rawIban=String(payload?.iban||"").replace(/[\s-]/g,"").toUpperCase();
 const iban=/^\d{26}$/.test(rawIban)?"PL"+rawIban:rawIban;
 const number=String(payload?.statementNumber||"").trim();
 const rows=payload?.transactions;
 if(!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(iban)||!number||number.length>100||
 !Array.isArray(rows)||rows.length<1||rows.length>3000)throw new Error("Podaj IBAN, numer wyciągu i 1–3000 transakcji.");
 const opening=money(payload.openingBalance),closing=money(payload.closingBalance);
 const periodEnd=date(payload.periodEnd),periodStart=payload.periodStart?date(payload.periodStart):null;
 if(periodStart&&periodStart>periodEnd)throw new Error("Nieprawidłowa kolejność dat okresu.");
 const transactions=rows.map((r,i)=>{
  const bookedAt=date(r.date),amount=money(r.amount);
  if(bookedAt>periodEnd||(periodStart&&bookedAt<periodStart))throw new Error("Data transakcji jest poza okresem wyciągu.");
  const description=String(r.description||"").slice(0,1000);
  const counterparty=String(r.counterparty||"").slice(0,250);
  const reference=String(r.reference||"").slice(0,250);
  const fingerprint=crypto.createHash("sha256").update(JSON.stringify([i,bookedAt.toISOString(),amount,description,counterparty,reference])).digest("hex");
  return {bookedAt,amount,description,counterparty,reference,fingerprint};
 });
 const sum=transactions.reduce((a,r)=>a+Math.round(Number(r.amount)*100),0);
 if(Math.abs(Math.round(Number(opening)*100)+sum-Math.round(Number(closing)*100))>1)
  throw new Error("Saldo początkowe + suma transakcji nie zgadza się z saldem końcowym.");
 const sourceHash=crypto.createHash("sha256").update(JSON.stringify({iban,number,opening,closing,periodEnd,transactions})).digest("hex");
 return prisma.$transaction(async tx=>{
  const account=await tx.bankAccount.upsert({where:{organizationId_iban:{organizationId:orgId,iban}},
   create:{organizationId:orgId,iban,currency:"PLN",label:String(payload.label||"").slice(0,100)||null},
   update:{}});
  const existing=await tx.bankStatement.findFirst({where:{organizationId:orgId,bankAccountId:account.id,statementNumber:number}});
  if(existing)throw new OrganizationError("Wyciąg o tym numerze już istnieje dla tego rachunku.",409);
  const statement=await tx.bankStatement.create({data:{organizationId:orgId,bankAccountId:account.id,statementNumber:number,
   sourceHash,openingBalance:opening,closingBalance:closing,periodStart,periodEnd,importedByUserId:userId,transactionCount:transactions.length}});
  await tx.bankTransaction.createMany({data:transactions.map(t=>({...t,organizationId:orgId,bankAccountId:account.id,bankStatementId:statement.id}))});
  return {id:statement.id,transactionCount:transactions.length,openingBalance:opening,closingBalance:closing,periodEnd};
 });
}
module.exports={importStatement};
