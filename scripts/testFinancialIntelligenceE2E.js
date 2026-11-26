"use strict";
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const { once } = require("node:events");

async function checkChart(company, token, api, year, month) {
  const { spawn } = require("node:child_process");
  const { setTimeout: delay } = require("node:timers/promises");
  const { chromium } = require("playwright");
  const path = require("node:path");
  const frontend = path.resolve(__dirname, "../frontend");
  const port = 3041;
  const web = "http://127.0.0.1:"+port;
  const child = spawn(process.execPath, [path.join(frontend,"node_modules/next/dist/bin/next"),
    "dev","--hostname","127.0.0.1","--port",String(port)], {
    cwd:frontend,stdio:"inherit",env:{PATH:process.env.PATH,HOME:frontend,
      API_PROXY_TARGET:api,NEXT_TELEMETRY_DISABLED:"1"}
  });
  const exited = once(child, "exit");
  let browser;
  try {
    const chart = web+"/company/"+company.id+"/bank/reports";
    let ready = false;
    for (let attempt = 0; attempt < 120 && child.exitCode === null; attempt++) {
      try {
        if ((await fetch(chart,{signal:AbortSignal.timeout(1000)})).ok) { ready=true; break; }
      } catch {}
      await delay(250);
    }
    assert.ok(ready, "Local Next.js did not start");
    browser = await chromium.launch({executablePath:process.env.PRZEMAI_CHROMIUM||"/usr/bin/chromium",
      args:["--no-sandbox"],headless:true});
    const page = await browser.newPage();
    await page.addInitScript(value=>localStorage.setItem("token",value),token);
    await page.goto(chart);
    const label = new Intl.DateTimeFormat("pl",{month:"long",timeZone:"UTC"})
      .format(new Date(Date.UTC(year,month-1,1)));
    await page.getByRole("button",{name:new RegExp("Wpływy · "+label+" ·","i")}).click();
    await page.getByRole("list").filter({hasText:"Syntetyczny odbiorca"}).waitFor();
    assert.match(await page.locator("[aria-live=polite]").innerText(),/Syntetyczny odbiorca/);
  } finally {
    await browser?.close();
    child.kill();
    await Promise.race([exited,delay(5000,{ref:false})]);
    if(child.exitCode===null&&child.signalCode===null)child.kill("SIGKILL");
  }
}

async function main() {
  const database = new URL(process.env.DATABASE_URL);
  assert.equal(database.protocol, "postgresql:");
  assert.equal(database.hostname, "127.0.0.1");
  assert.match(database.pathname, /^\/przemai_p0_e2e_[a-z0-9_]+$/);
  const db = require("../lib/prisma");
  const express = require("express");
  const jwt = require("jsonwebtoken");
  const Sources = require("../api/services/GeneralAgentSources");
  const { OrganizationSettlementService } = require("../api/services/OrganizationSettlementService");
  process.env.JWT_SECRET = randomUUID();
  const app = express();
  app.use(express.json());
  app.use("/api/organizations",require("../api/routes/organizationRoutes"));
  app.use("/api/auth",require("../api/routes/authRoutes"));
  const server = app.listen(0, "127.0.0.1");
  try {
    await once(server, "listening");
    const [owner, employee] = await Promise.all(["owner", "employee"].map(label => db.user.create({
      data: {email:label+"-"+randomUUID()+"@example.test",password:"unused"}
    })));
    const [dek, deh] = await Promise.all([["Dekonica","1111111111"],["Deherus","2222222222"]]
      .map(([name,nip]) => db.organization.create({data:{
        name,slug:name.toLowerCase()+"-"+randomUUID(),
        financeLink:{create:{ownerUserId:owner.id,nip}},
        memberships:{create:[{userId:owner.id,role:"OWNER"},
          {userId:employee.id,role:"MEMBER",financeAccess:name==="Dekonica"}]}
      }})));
    const calendar = new Date();
    const year = calendar.getUTCFullYear();
    const month = calendar.getUTCMonth()+1;
    const booking = new Date(Date.UTC(year,month-1,1));
    const issue = new Date(Date.UTC(year,month-1,1));
    const lastMonth = new Date(Date.UTC(year,month-1,0));
    const late = new Date(issue.getTime()-86400000);
    const monthEnd = new Date(Date.UTC(year,month,0));
    const endpoint = "http://127.0.0.1:"+server.address().port;
    async function request(company,user,path,method="GET",payload) {
      const response = await fetch(endpoint+"/api/organizations/"+company.id+path,{method,
        headers:{Authorization:"Bearer "+jwt.sign({id:user.id},process.env.JWT_SECRET),
          "Content-Type":"application/json"},body:payload&&JSON.stringify(payload)});
      return {status:response.status,...await response.json()};
    }
    const makeInvoice = (nip,invoiceNumber,values) => db.financialDocument.create({data:{
      userId:owner.id,source:"KSEF",currency:"PLN",direction:"OUTGOING",issueDate:issue,
      sellerNip:nip,buyerNip:"9999999999",invoiceNumber,externalId:randomUUID(),...values
    }});
    const n="FV/1472/"+year;
    const [invoice,correction,unpaid,bill,foreign] = await Promise.all([
      makeInvoice("1111111111",n,{grossAmount:123,vatAmount:23,netAmount:100,dueDate:late}),
      makeInvoice("1111111111","KOR/289/"+year,{grossAmount:-10,vatAmount:0,netAmount:-10,invoiceType:"Kor"}),
      makeInvoice("1111111111","FV/NOWA",{grossAmount:50,netAmount:50,dueDate:monthEnd}),
      makeInvoice("1111111111","Czynsz",{direction:"INCOMING",buyerNip:"1111111111",
        sellerNip:"9999999999",sellerName:"Czynsz",grossAmount:20,netAmount:20,dueDate:monthEnd,metadata:{
          costAccounting:{source:"MANUAL",category:"RENT",type:"FIXED"},
          ksefXmlRetry:{code:"INVALID_XML",reason:"FORMAT",sensitive:"must-not-leak"}
        }}),
      makeInvoice("2222222222","FOREIGN",{grossAmount:8000})
    ]);
    const project=await db.project.create({data:{userId:owner.id,name:"Syntetyczny P1",company:"Dekonica"}});
    await db.organizationInvestment.create({data:{organizationId:dek.id,name:project.name,assignedUserIds:[employee.id]}});
    await db.financialDocument.updateMany({where:{id:{in:[invoice.id,bill.id]}},data:{projectId:project.id}});
    async function operation(company,type,amount,description) {
      const bank = await db.bankAccount.create({data:{organizationId:company.id,iban:"TEST-"+randomUUID(),accountType:type,
        statements:{create:{organizationId:company.id,statementNumber:randomUUID(),sourceHash:randomUUID(),
          periodEnd:lastMonth,closingBalance:type==="VAT"?0:1000,importedByUserId:owner.id}}},include:{statements:true}});
      return db.bankTransaction.create({data:{organizationId:company.id,bankAccountId:bank.id,
        bankStatementId:bank.statements[0].id,fingerprint:randomUUID(),bookedAt:booking,
        amount,description,counterparty:"Syntetyczny odbiorca"}});
    }
    const [net,vat,other] = await Promise.all([
      operation(dek,"CURRENT",90,"Opłata "+n),
      operation(dek,"VAT",23,"/VAT/23,00/INV/"+n),
      operation(deh,"CURRENT",90,"Opłata "+n)
    ]);
    const root="/finance/settlements";
    const report=async()=> (await request(dek,owner,root+"/"+year)).data;
    const item=(data,id)=>data.items.find(row=>row.id===id);
    const pay=(user,id,transactionId)=>request(dek,user,root+"/"+id+"/payments","POST",{transactionId});
    const initial=await report();
    assert.equal(item(initial,invoice.id).status,dayBeforeToday(late)?"OVERDUE":"UNPAID");
    assert.equal(item(initial,unpaid.id).status,"UNPAID");
    assert.equal(initial.diagnostics.FORMAT,1);
    assert.doesNotMatch(JSON.stringify(initial),/must-not-leak|FOREIGN/);
    assert.equal((await request(deh,employee,root+"/"+year)).status,403);
    assert.equal((await pay(employee,invoice.id,net.id)).status,403);
    assert.equal((await pay(owner,invoice.id,other.id)).status,404);
    assert.equal((await pay(owner,foreign.id,net.id)).status,404);
    const candidates=await request(dek,employee,"/finance/bank-matches/"+year);
    assert.equal(candidates.status,200,JSON.stringify(candidates));
    const selected=[...candidates.data.proposed,...candidates.data.conflicts].filter(row=>row.invoiceId===invoice.id);
    assert.equal(selected.length,2);
    assert.ok(selected.every(row=>row.verifiedPayment===false));
    const corrections=root+"/"+invoice.id+"/corrections";
    assert.equal((await request(dek,owner,corrections,"POST",{correctionId:correction.id})).status,200);
    assert.equal((await pay(owner,invoice.id,net.id)).status,200);
    assert.equal((await pay(owner,invoice.id,net.id)).status,200);
    const partial=await report();
    assert.equal(item(partial,invoice.id).status,"PARTIAL");
    assert.equal(item(partial,invoice.id).outstanding,"23.00");
    assert.equal((await pay(owner,invoice.id,vat.id)).status,200);
    const paid=await report();
    assert.equal(item(paid,invoice.id).status,"PAID");
    assert.equal(item(paid,invoice.id).payments.length,2);
    assert.equal(item(paid,correction.id).status,"CORRECTION_APPLIED");
    assert.equal(paid.balances[0].fixedCosts,"20.00");
    assert.equal(paid.balances[0].receivable,"50.00");
    assert.equal(paid.balances[0].payable,"20.00");
    assert.equal(paid.forecast[0].balanceFromImports,"1113.00");
    assert.equal(paid.forecast[0].projectedMonthEnd,"1143.00");
    const detail=await request(dek,employee,"/bank/activity/"+year+"/"+month+"?direction=inflows&currency=PLN");
    assert.deepEqual(new Set(detail.data.items.map(row=>row.id)),new Set([net.id,vat.id]));
    assert.equal((await request(deh,employee,"/bank/activity/"+year+"/"+month+"?direction=inflows&currency=PLN")).status,403);
    const sources=new Sources(db);
    const context=await sources.load({userId:employee.id,organizationId:dek.id,agentKey:"financial"},
      "Rozliczenia i rentowność inwestycji "+year);
    assert.equal(context.financialReports[0].summary.PAID,1);
    assert.equal(context.investmentProfitability[0].profitability[0].netResult,"70.00");
    assert.doesNotMatch(JSON.stringify(context),/must-not-leak|FOREIGN/);
    assert.equal(await sources.authorize({userId:employee.id,organizationId:dek.id,agentKey:"financial",
      investmentIds:context.investmentIds,bankData:context.bankData}),true);
    await db.organizationInvestment.updateMany({where:{organizationId:dek.id},data:{assignedUserIds:[]}});
    assert.equal(await sources.authorize({userId:employee.id,organizationId:dek.id,agentKey:"financial",
      investmentIds:context.investmentIds,bankData:context.bankData}),false);
    const dbReport=new OrganizationSettlementService({db});
    const historic=await dbReport.report(owner.id,dek.id,year,lastMonth);
    assert.equal(historic.items.length,0);
    assert.equal((await request(dek,owner,root+"/payments/"+vat.id,"DELETE")).status,200);
    assert.equal(item(await report(),invoice.id).status,"PARTIAL");
    assert.equal((await request(dek,owner,root+"/corrections/"+correction.id,"DELETE")).status,200);
    assert.equal(item(await report(),invoice.id).outstanding,"33.00");
    if(process.env.PRZEMAI_P1_BROWSER==="true")await checkChart(dek,
      jwt.sign({id:employee.id},process.env.JWT_SECRET),endpoint,year,month);
    const topup=await operation(dek,"CURRENT",10,"Dopłata "+n);
    assert.equal((await pay(owner,invoice.id,topup.id)).status,200);
    assert.equal((await pay(owner,invoice.id,vat.id)).status,200);
    assert.equal((await request(dek,owner,corrections,"POST",{correctionId:correction.id})).status,200);
    assert.equal(item(await report(),invoice.id).overpayment,"10.00");
    const refund=await operation(dek,"CURRENT",-10,"Zwrot KOR/289/"+year);
    const refundMatches=await request(dek,owner,"/finance/bank-matches/"+year);
    assert.equal(refundMatches.data.proposed.find(row=>row.transactionId===refund.id)?.refundInvoiceId,invoice.id);
    assert.equal((await pay(owner,invoice.id,refund.id)).status,200);
    assert.equal(item(await report(),invoice.id).overpayment,"0.00");
    const competing=await Promise.all([operation(dek,"CURRENT",40,"Wpłata A"),
      operation(dek,"CURRENT",40,"Wpłata B")]);
    const parallel=await Promise.all(competing.map(row=>pay(owner,unpaid.id,row.id)));
    assert.deepEqual(parallel.map(row=>row.status).sort(),[200,409]);
    assert.equal(item(await report(),unpaid.id).outstanding,"10.00");
    console.log("Financial Intelligence P1 PostgreSQL E2E passed");
  } finally {
    await new Promise(resolve=>server.close(resolve));
    await db.$disconnect();
  }
}
const dayBeforeToday = value => value.toISOString().slice(0,10)<new Date().toISOString().slice(0,10);
main().catch(error=>{console.error(error);process.exitCode=1;});
