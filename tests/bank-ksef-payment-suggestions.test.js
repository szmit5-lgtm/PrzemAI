"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {suggestMatches,invoiceNumberPattern,amountCents,MAX_INVOICES,MAX_OPERATIONS}=
 require("../api/services/BankKsefMatchEngine");
const {OrganizationBankKsefMatchService}=require("../api/services/OrganizationBankKsefMatchService");
const ownNip="1234567890",otherNip="9876543210";
const invoice=(id,dir,number="FV/101/2026",gross="123.45")=>({
 id,source:"KSEF",direction:dir,invoiceNumber:number,
 issueDate:new Date("2026-06-01T12:00:00Z"),grossAmount:gross,
 currency:"PLN",sellerName:dir==="INCOMING"?"Hurtownia Testowa":"Dekonica",
 buyerName:dir==="OUTGOING"?"Klient Testowy":"Dekonica",
 sellerNip:dir==="INCOMING"?otherNip:ownNip,
 buyerNip:dir==="OUTGOING"?otherNip:ownNip
});
const operation=(id,amount,description="Przelew za FV/101/2026",accountType="CURRENT")=>({
 id,amount,description,counterparty:"Hurtownia Testowa",reference:"",
 bookedAt:new Date("2026-06-10T12:00:00Z"),
 reviewStatus:"UNMATCHED",
 bankAccount:{currency:"PLN",accountType,iban:"PL61109010140000071219812874"}
});
test("outgoing purchases and incoming sales are suggested only for exact invoice gross amount",()=>{
 const invoices=[
  invoice("purchase","INCOMING","FV/101/2026","123.45"),
  invoice("sale","OUTGOING","FS/122/2026","200.00")
 ];
 const tx=[operation("paid","-123.45"),
  {...operation("received","200.00","Zapłata FS/122/2026"),counterparty:"Klient Testowy"}];
 const result=suggestMatches(invoices,tx,ownNip);
 assert.equal(result.totals.uniqueProposals,2);
 assert.equal(result.proposed[0].direction,"INCOMING");
 assert.equal(result.proposed[0].transactionAmount,"-123.45");
 assert.equal(result.proposed[0].verifiedPayment,false);
 assert.equal(result.proposed[0].confidence,"STRONG");
 assert.equal(result.proposed[1].direction,"OUTGOING");
 assert.equal(result.proposed[1].transactionAmount,"200.00");
});
test("wrong currency, VAT accounts, paid or unmatched status, and foreign-company invoices are excluded",()=>{
 const foreign=invoice("foreign","INCOMING");
 foreign.buyerNip="5678901234";
 const valid=invoice("good","INCOMING");
 const otherCurrency={...operation("EUR","-123.45"),bankAccount:{currency:"EUR",accountType:"CURRENT",iban:"PL61109010140000071219812874"}};
 const reviewed={...operation("done","-123.45"),reviewStatus:"MATCHED"};
 const vat=operation("vat","-123.45","FV/101/2026","VAT");
 const res=suggestMatches([foreign,valid],[otherCurrency,reviewed,vat],ownNip);
 assert.equal(res.proposed.length,0);
 assert.equal(res.conflicts.length,0);
});
test("ambiguous invoices or bank operations are never represented as unique payment evidence",()=>{
 const same1=invoice("a","INCOMING");
 const same2=invoice("b","INCOMING");
 const result=suggestMatches([same1,same2],[operation("tx","-123.45")],ownNip);
 assert.equal(result.proposed.length,0);
 assert.equal(result.conflicts.length,2);
 assert.ok(result.conflicts.every(x=>x.confidence==="AMBIGUOUS"));
 const second=suggestMatches([same1],[operation("tx1","-123.45"),operation("tx2","-123.45")],ownNip);
 assert.equal(second.proposed.length,0);
 assert.equal(second.conflicts.length,2);
});
test("reference matcher requires significant invoice number with boundaries",()=>{
 assert.equal(invoiceNumberPattern("1/26"),null);
 assert.equal(invoiceNumberPattern("XX"),null);
 const pattern=invoiceNumberPattern("FV/101/2026");
 assert.ok(pattern.test("PRZELEW ZA FV 101 2026 ZAKUP"));
 assert.ok(!pattern.test("ZAPLATA 9FV 101 20269"));
 assert.equal(amountCents("12.345"),null);
 assert.equal(amountCents("12.34"),1234n);
});
test("amount-only invoice is review suggestion only when counterparty also agrees",()=>{
 const res=suggestMatches([invoice("one","INCOMING","FV/101/2026")],
  [operation("tx","-123.45","Przelew za towar")],ownNip);
 assert.equal(res.proposed.length,1);
 assert.equal(res.proposed[0].confidence,"REVIEW");
 const absent=suggestMatches([invoice("one","INCOMING","FV/101/2026")],
  [{...operation("tx","-123.45","Przelew za towar"),counterparty:"Zupełnie Inna Firma"}],ownNip);
 assert.equal(absent.proposed.length,0);
});
test("a date before invoice issue or later than six months is not claimed as matched",()=>{
 const inv=invoice("one","INCOMING");
 const early={...operation("early","-123.45"),bookedAt:new Date("2026-05-31T12:00:00Z")};
 const late={...operation("late","-123.45"),bookedAt:new Date("2027-01-30T12:00:00Z")};
 assert.equal(suggestMatches([inv],[early,late],ownNip).proposed.length,0);
});
test("read service enforces both KSeF and bank grants and scopes both queries to company",async()=>{
 const calls=[];
 const data={
  financialDocument:{async findMany(args){calls.push({type:"docs",args});return [invoice("invoice","INCOMING")];}},
  bankTransaction:{async findMany(args){calls.push({type:"bank",args});return [operation("tx","-123.45")];}}
 };
 const finance={async accessible(userId,orgId){calls.push({type:"finance",userId,orgId});return {ownerUserId:"owner",nip:ownNip};}};
 const bankAccess={async authorize(userId,orgId){calls.push({type:"access",userId,orgId});}};
 const service=new OrganizationBankKsefMatchService({db:data,finance,bankAccess});
 const result=await service.review("owner","dekonica",2026);
 assert.equal(result.organizationId,"dekonica");
 assert.equal(result.totals.uniqueProposals,1);
 assert.deepEqual(calls.slice(0,2).map(x=>x.type),["finance","access"]);
 assert.equal(calls.find(x=>x.type==="bank").args.where.organizationId,"dekonica");
 const and=calls.find(x=>x.type==="docs").args.where.AND;
 assert.equal(and[0].userId,"owner");
 assert.equal(and[0].source,"KSEF");
 assert.ok(and[0].OR.some(x=>x.buyerNip===ownNip));
 assert.equal(calls.find(x=>x.type==="docs").args.take,MAX_INVOICES+1);
 assert.equal(calls.find(x=>x.type==="bank").args.take,MAX_OPERATIONS+1);
});
test("missing KSeF access blocks bank queries and bank denial blocks invoice query",async()=>{
 const calls=[];
 const db={
  financialDocument:{async findMany(){calls.push("docs");return [];}},
  bankTransaction:{async findMany(){calls.push("bank");return [];}}
 };
 const finance={async accessible(){throw Object.assign(new Error("Brak KSeF"),{status:403});}};
 const bankAccess={async authorize(){throw Object.assign(new Error("Brak banku"),{status:403});}};
 const noFin=new OrganizationBankKsefMatchService({db,finance,bankAccess});
 await assert.rejects(noFin.review("user","dekonica",2026),/Brak KSeF/);
 const withFin=new OrganizationBankKsefMatchService({db,finance:{async accessible(){return {nip:ownNip,ownerUserId:"owner"};}},bankAccess});
 await assert.rejects(withFin.review("user","dekonica",2026),/Brak banku/);
 assert.deepEqual(calls,[]);
});
test("suggestions remain read-only and confirmation uses a separate authenticated endpoint",()=>{
 const routes=fs.readFileSync(path.join(__dirname,"../api/routes/organizationRoutes.js"),"utf8");
 const ui=fs.readFileSync(path.join(__dirname,"../frontend/src/app/company/[id]/finance/bank-matches/page.js"),"utf8");
 const main=fs.readFileSync(path.join(__dirname,"../frontend/src/app/company/[id]/finance/page.js"),"utf8");
 const client=fs.readFileSync(path.join(__dirname,"../frontend/src/lib/api.js"),"utf8");
 const svc=fs.readFileSync(path.join(__dirname,"../api/services/OrganizationBankKsefMatchService.js"),"utf8");
 assert.match(routes,/router.get\("\/:id\/finance\/bank-matches\/:year"/);
 assert.match(ui,/getOrganizationBankKsefMatches\(id,year\)/);
 assert.match(routes,/router.post\("\/:id\/finance\/settlements\/:invoiceId\/payments",verifyToken/);
 assert.match(ui,/window.confirm\(/);
 assert.match(ui,/changeOrganizationSettlement\(/);
 assert.match(main,/finan[c]?e\/bank-matches/);
 assert.match(client,/getOrganizationBankKsefMatches\(orgId,year\)/);
 assert.doesNotMatch(svc,/\.updateMany\(|\.create\(|\.deleteMany\(/);
});
