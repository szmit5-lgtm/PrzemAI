"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {OrganizationInvestmentFinanceService,reportForProjects,amountToCents,toMoney,
 normalizeProjectName,assignedCompanyDirection}=
 require("../api/services/OrganizationInvestmentFinanceService");

const nip="1112223334";
const other="5556667778";
const project=(id,name)=>({id,name,company:"Dekonica",aliases:[]});
const investment=(id,name)=>({id,name,status:"IN_PROGRESS",progress:40});
const doc=(id,projectId,{direction="INCOMING",buyerNip=nip,sellerNip=other,
 currency="PLN",netAmount="100.00",vatAmount="23.00",grossAmount="123.00",
 issueDate=new Date("2026-10-21T00:00:00Z")}={})=>({
 id,projectId,direction,buyerNip,sellerNip,currency,netAmount,vatAmount,grossAmount,issueDate
});
const compute=(overrides={})=>reportForProjects({
 organizationId:"dekonica",year:2026,nip,
 investments:[investment("i1","Mielno"),investment("i2","Zgorzelec")],
 projects:[project("p1","Mielno"),project("p2","Zgorzelec")],
 documents:[
  doc("1","p1"),doc("2","p1",{netAmount:"50.10",vatAmount:"11.52",grossAmount:"61.62"}),
  doc("3","p2",{netAmount:"20.00",vatAmount:"4.60",grossAmount:"24.60"})
 ],
 ...overrides
});

test("isolates real assigned KSeF purchases by investment, with decimal-exact net VAT gross",()=>{
 const r=compute();
 assert.equal(r.source,"KSEF_PROJECT_ASSIGNMENTS");
 assert.equal(r.organizationId,"dekonica");
 assert.equal(r.counts.matchedInvoices,3);
 assert.equal(r.investments.length,2);
 assert.equal(r.investments[0].accountMapping,"EXACT_NAME");
 assert.equal(r.investments[0].legacyProjectId,"p1");
 assert.equal(r.investments[0].documents,2);
 assert.deepEqual(r.investments[0].totals,[{
  currency:"PLN",direction:"INCOMING",count:2,net:"150.10",vat:"34.52",
  gross:"184.62",missingNet:0,missingVat:0,missingGross:0
 }]);
 assert.equal(r.investments[0].months[0].month,10);
 assert.equal(r.investments[1].totals[0].net,"20.00");
 assert.equal(r.investments[1].totals[0].vat,"4.60");
 assert.equal(r.investments[1].totals[0].gross,"24.60");
});
test("sales separate from purchases, EUR separate from PLN, exact cents preserved",()=>{
 const r=compute({documents:[
  doc("a","p1",{netAmount:"0.10",vatAmount:"0.02",grossAmount:"0.12"}),
  doc("b","p1",{netAmount:"0.20",vatAmount:"0.05",grossAmount:"0.25"}),
  doc("c","p1",{direction:"OUTGOING",buyerNip:other,sellerNip:nip,
   netAmount:"100.00",vatAmount:"23.00",grossAmount:"123.00"}),
  doc("d","p1",{currency:"EUR",netAmount:"10.00",vatAmount:"0.00",grossAmount:"10.00"})
 ]});
 assert.equal(r.investments[0].totals.length,3);
 const buy=r.investments[0].totals.find(x=>x.currency==="PLN"&&x.direction==="INCOMING");
 assert.equal(buy.net,"0.30");
 assert.equal(buy.vat,"0.07");
 assert.equal(buy.gross,"0.37");
 assert.equal(r.investments[0].totals.find(x=>x.currency==="EUR").gross,"10.00");
 assert.equal(r.investments[0].totals.find(x=>x.direction==="OUTGOING").gross,"123.00");
});
test("does not assign unknown, foreign NIP or opposite direction invoices",()=>{
 const r=compute({documents:[
  doc("foreign","p1",{buyerNip:other,sellerNip:"9999999999"}),
  doc("opposite","p1",{direction:"OUTGOING"}),
  doc("unassigned",null),
  doc("not-own-project","foreignproject"),
  doc("valid","p1")
 ]});
 assert.equal(r.counts.matchedInvoices,1);
 assert.equal(r.counts.unassignedInvoices,1);
 assert.equal(r.counts.otherProjectAssignments,1);
 assert.equal(r.counts.rejectedDirection,2);
 assert.equal(r.investments[0].documents,1);
 assert.equal(r.investments[1].documents,0);
});
test("similar investment names never cause fuzzy matching or duplicated totals",()=>{
 const r=compute({
 investments:[investment("i1","Mielno Przedszkole"),investment("i2","Zgorzelec")],
 projects:[project("p1","Mielno"),project("p2","Zgorzelec")],
 documents:[doc("a","p1"),doc("b","p2")]
 });
 assert.equal(r.investments[0].accountMapping,"UNLINKED");
 assert.equal(r.investments[0].documents,0);
 assert.equal(r.investments[1].documents,1);
 assert.equal(r.otherKsefProjects.length,1);
 assert.equal(r.otherKsefProjects[0].name,"Mielno");
 assert.equal(r.otherKsefProjects[0].documents,1);
 assert.equal(r.counts.matchedInvoices,2);
});
test("same normalized project claimed by two investments is ambiguous and never silently assigned",()=>{
 const r=compute({
 investments:[investment("i1","Mielno Żłobek"),investment("i2","Mielno Zlobek")],
 projects:[project("p1","Mielno Żłobek")],
 documents:[doc("a","p1")]
 });
 assert.ok(r.investments.every(x=>x.accountMapping==="AMBIGUOUS"&&x.documents===0));
 assert.equal(r.otherKsefProjects[0].documents,1);
 assert.equal(r.counts.matchedInvoices,1);
 assert.equal(normalizeProjectName("Mielno Żłobek"),"mielno zlobek");
});
test("null or bad invoice VAT does not make a misleading partial total",()=>{
 const r=compute({documents:[
  doc("a","p1",{netAmount:"100.00",vatAmount:null,grossAmount:"123.00"}),
  doc("b","p1",{netAmount:"20.00",vatAmount:"invalid",grossAmount:null})
 ]});
 const row=r.investments[0].totals[0];
 assert.equal(row.net,"120.00");
 assert.equal(row.vat,null);
 assert.equal(row.gross,null);
 assert.equal(row.missingVat,2);
 assert.equal(row.missingGross,1);
 assert.equal(amountToCents("10.010"),null);
 assert.equal(toMoney(amountToCents("9999999999999999.99")),"9999999999999999.99");
});
test("service checks company finance access before requesting any other documents or projects",async()=>{
 const calls=[];
 const finance={
  async accessible(actor,org){calls.push({type:"auth",actor,org});
   if(actor==="intruder")throw Object.assign(new Error("Brak uprawnień"),{status:403});
   return {ownerUserId:"owner",nip};},
  async projects(actor,org){calls.push({type:"projects",actor,org});
   return{items:[project("p1","Mielno")]};}
 };
 const db={
  organizationInvestment:{async findMany(q){calls.push({type:"invest",q});return [investment("i1","Mielno")];}},
  financialDocument:{async findMany(q){calls.push({type:"docs",q});return [doc("a","p1")];}}
 };
 const service=new OrganizationInvestmentFinanceService({db,finance});
 await assert.rejects(service.report("intruder","dekonica","2026"),/Brak uprawnień/);
 assert.deepEqual(calls.map(x=>x.type),["auth"]);
 const report=await service.report("owner","dekonica",2026);
 assert.equal(report.counts.matchedInvoices,1);
 assert.deepEqual(calls.map(x=>x.type).slice(1),["auth","projects","invest","docs"]);
 assert.equal(calls.find(x=>x.type==="invest").q.where.organizationId,"dekonica");
 const condition=calls.find(x=>x.type==="docs").q.where;
 assert.equal(condition.AND[0].userId,"owner");
 assert.equal(condition.AND[0].source,"KSEF");
 assert.deepEqual(condition.AND[0].OR,[{buyerNip:nip},{sellerNip:nip}]);
 assert.equal(condition.AND[1].issueDate.gte.toISOString(),"2026-01-01T00:00:00.000Z");
 assert.equal(condition.direction.in.length,2);
});
test("wrong-year input does not query data and report is read-only",async()=>{
 let reads=0;
 const finance={async accessible(){return{ownerUserId:"owner",nip};},
  async projects(){reads++;return{items:[]};}};
 const db={organizationInvestment:{async findMany(){reads++;return[];}},
  financialDocument:{async findMany(){reads++;return[];}}};
 const service=new OrganizationInvestmentFinanceService({db,finance});
 await assert.rejects(service.report("owner","dekonica",2018),/rok raportu/);
 assert.equal(reads,0);
 const source=fs.readFileSync(path.join(__dirname,"../api/services/OrganizationInvestmentFinanceService.js"),"utf8");
 assert.doesNotMatch(source,/\.updateMany\(|\.deleteMany\(|\.create\(/);
 assert.equal(assignedCompanyDirection(doc("a","p1"),nip),true);
});
test("routes, API client and responsive report expose firm-scoped investment totals",()=>{
 const routes=fs.readFileSync(path.join(__dirname,"../api/routes/organizationRoutes.js"),"utf8");
 const client=fs.readFileSync(path.join(__dirname,"../frontend/src/lib/api.js"),"utf8");
 const home=fs.readFileSync(path.join(__dirname,"../frontend/src/app/company/[id]/finance/page.js"),"utf8");
 const page=fs.readFileSync(path.join(__dirname,"../frontend/src/app/company/[id]/finance/investments/page.js"),"utf8");
 assert.match(routes,/router\.get\("\/:id\/finance\/investments\/:year",verifyToken/);
 assert.match(routes,/investmentFinance\.report\(req\.user\.id,req\.params\.id,req\.params\.year,member\)/);
 assert.match(client,/getOrganizationInvestmentFinanceReport\(orgId,year\)/);
 assert.match(home,/finance\/investments"/);
 assert.match(page,/getOrganizationInvestmentFinanceReport\(id,year\)/);
 assert.match(page,/accountMapping/);
 assert.match(page,/missingGross/);
 assert.match(page,/Mielno, Zgorzelec/);
 assert.match(page,/Nie doliczamy ich arbitralnie/);
});
