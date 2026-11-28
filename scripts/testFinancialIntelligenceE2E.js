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
    page.on("pageerror", error => console.error("Browser error:", error.message));
    await page.context().addCookies([{name:"przemai-session",value:token,url:web,httpOnly:true,sameSite:"Strict"}]);
    await page.goto(web);
    const cards=page.getByRole("region",{name:"Faktury w wybranym okresie"});
    const sales=cards.locator("section").filter({hasText:"Faktury sprzedażowe PLN"});
    await sales.getByText(/7\s?547,41 zł netto/).waitFor();
    await page.getByRole("button",{name:"Deherus",exact:true}).click();
    await sales.getByText(/7\s?407,41 zł netto/).waitFor();
    await page.getByRole("button",{name:"Dekonica",exact:true}).click();
    await sales.getByText("140,00 zł netto").waitFor();
    await sales.getByText("163,00 zł brutto").waitFor();
    await page.getByLabel("Okres",{exact:true}).selectOption("m"+month);
    await sales.getByText("140,00 zł netto").waitFor();
    if(month!==1){
      await page.getByLabel("Okres",{exact:true}).selectOption("m1");
      await sales.getByText("0,00 zł netto").waitFor();
    }
    await page.getByRole("link",{name:"Wpływy i wydatki",exact:true}).click();
    const label = new Intl.DateTimeFormat("pl",{month:"long",timeZone:"UTC"})
      .format(new Date(Date.UTC(year,month-1,1)));
    await page.getByRole("button",{name:new RegExp("Wpływy · "+label+" ·","i")}).click();
    await page.getByRole("list").filter({hasText:"Syntetyczny odbiorca"}).waitFor();
    assert.match(await page.locator("[aria-live=polite]").innerText(),/Syntetyczny odbiorca/);
    await page.getByRole("button",{name:new RegExp("Wydatki · "+label+" ·","i")}).click();
    await page.getByText("Zwrot KOR/289/"+year,{exact:true}).waitFor();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(web + "/raport-wlasciciela");
    await page.getByRole("heading", { name: "Poranny raport właściciela" }).waitFor();
    await page.getByRole("heading", { name: "Dekonica", exact: true }).waitFor();
    await page.getByRole("heading", { name: "Deherus", exact: true }).waitFor();
    const alerts = page.getByRole("region", { name: "Alerty wymagające uwagi" });
    await alerts.getByText("Termin Dekoniki", { exact: false }).waitFor();
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
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
  app.use("/api/executive",require("../api/routes/executiveRoutes"));
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
      makeInvoice("2222222222","FOREIGN",{grossAmount:8000,netAmount:"7407.41",vatAmount:"592.59"})
    ]);
    const dashboard=async (user,company)=>{
      const url=endpoint+"/api/organizations/invoice-dashboard/"+year+
        (company?"?organizationId="+company.id:"");
      const response=await fetch(url,{headers:{Authorization:"Bearer "+jwt.sign({id:user.id},process.env.JWT_SECRET)}});
      return {status:response.status,...await response.json()};
    };
    const sales = report => report.data.rows.find(row=>row.month===month&&row.direction==="OUTGOING");
    const [dekInvoices,dehInvoices,allInvoices,limitedInvoices]=await Promise.all([
      dashboard(owner,dek),dashboard(owner,deh),dashboard(owner),dashboard(employee)
    ]);
    assert.deepEqual([sales(dekInvoices).net,sales(dekInvoices).gross],["140.00","163.00"]);
    assert.deepEqual([sales(dehInvoices).net,sales(dehInvoices).gross],["7407.41","8000.00"]);
    assert.deepEqual([sales(allInvoices).net,sales(allInvoices).gross],["7547.41","8163.00"]);
    const purchases=allInvoices.data.rows.find(row=>row.month===month&&row.direction==="INCOMING");
    assert.deepEqual([purchases.net,purchases.gross],["20.00","20.00"]);
    assert.equal(limitedInvoices.data.included,1);
    assert.equal(limitedInvoices.data.excluded,1);
    assert.deepEqual(sales(limitedInvoices),sales(dekInvoices));
    assert.equal((await dashboard(employee,deh)).status,403);
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
    const [ownedInvestment, foreignInvestment] = await Promise.all([dek, deh].map(company =>
      db.organizationInvestment.create({ data: { organizationId: company.id, name: "Syntetyczna inwestycja", status: "IN_PROGRESS" } })
    ));
    await db.task.createMany({ data: [
      { userId: owner.id, title: "Termin Dekoniki", investmentId: ownedInvestment.id, investmentScoped: true },
      { userId: owner.id, title: "Obca inwestycja", investmentId: foreignInvestment.id, investmentScoped: true },
      { userId: owner.id, title: "Odłączone zadanie inwestycyjne", investmentScoped: true }
    ].map(task => ({ ...task, source: "COMPANY", dueDate: late, metadata: { organizationId: dek.id } })) });
    const endpointBriefing = endpoint + "/api/executive/owner-briefing";
    assert.equal((await fetch(endpointBriefing)).status, 401);
    const readBriefing = user => fetch(endpointBriefing, {
      headers: { Authorization: "Bearer " + jwt.sign({ id: user.id }, process.env.JWT_SECRET) }
    });
    const ownerBriefing = await readBriefing(owner);
    assert.equal(ownerBriefing.status, 200);
    assert.match(ownerBriefing.headers.get("cache-control"), /no-store/);
    const { data: briefing } = await ownerBriefing.json();
    assert.deepEqual(briefing.companies.map(company => company.name).sort(), ["Deherus", "Dekonica"]);
    assert.equal(briefing.companies.find(company => company.id === dek.id).investments.IN_PROGRESS, 1);
    assert.deepEqual(briefing.companies.flatMap(company => company.dueTasks).map(task => task.title), ["Termin Dekoniki"]);
    assert.equal(new Set(briefing.alerts.map(alert => alert.id)).size, briefing.alerts.length);
    assert.ok(briefing.alerts.some(alert => alert.kind === "taskOverdue" && alert.title === "Termin Dekoniki"));
    assert.ok(briefing.alerts.some(alert => alert.organizationId === dek.id && alert.kind === "overdueReceivable"));
    const { data: employeeBriefing } = await (await readBriefing(employee)).json();
    assert.deepEqual(employeeBriefing.companies, []);
    assert.deepEqual(employeeBriefing.alerts, []);
    assert.equal(briefing.scheduledTime, "07:00");
    const { OwnerDailyBriefingService } = require("../api/services/OwnerDailyBriefingService");
    let generated = 0;
    const scheduler = new OwnerDailyBriefingService({ db, briefing: { read: async () => { generated++; return briefing; } } });
    await scheduler.runDue({ ownerId: owner.id, now: new Date("2026-03-29T04:59:00Z") });
    assert.equal(generated, 0);
    await Promise.all([1, 2].map(() => scheduler.runDue({ ownerId: owner.id, now: new Date("2026-03-29T05:00:00Z") })));
    assert.equal(generated, 1);
    const nextDay = await scheduler.decorate(owner.id, { ...briefing, day: "2026-03-30" });
    assert.equal(nextDay.comparison.find(company => company.name === "Dekonica").previous, 1);
    await scheduler.setSchedule(owner.id, "08:45");
    await scheduler.runDue({ ownerId: owner.id, now: new Date("2026-03-30T06:44:00Z") });
    assert.equal(generated, 1);
    await scheduler.runDue({ ownerId: owner.id, now: new Date("2026-03-30T06:45:00Z") });
    assert.equal(generated, 2);
    await assert.rejects(scheduler.setSchedule(employee.id, "08:45"), { status: 403 });
    console.log("Scheduled owner report E2E: Warsaw DST, one snapshot, comparison and custom time");
    const taskAlert = briefing.alerts.find(alert => alert.kind === "taskOverdue");
    const updateAlert = (user, status) => fetch(endpointBriefing + "/alerts", {
      method: "PATCH",
      headers: { Authorization: "Bearer " + jwt.sign({ id: user.id }, process.env.JWT_SECRET), "Content-Type": "application/json" },
      body: JSON.stringify({ alertId: taskAlert.id, status })
    });
    assert.equal((await updateAlert(employee, "CLOSED")).status, 404);
    for (const expected of ["ACKNOWLEDGED", "SNOOZED", "CLOSED", "OPEN"]) {
      assert.equal((await updateAlert(owner, expected)).status, 200);
      const { data: fresh } = await (await readBriefing(owner)).json();
      assert.equal(fresh.alerts.find(alert => alert.id === taskAlert.id).status, expected);
    }
    const reportEndpoint = endpoint + "/api/organizations/" + dek.id + "/investments/" + ownedInvestment.id + "/report";
    const exportReport = (user, format) => fetch(reportEndpoint + "?" + new URLSearchParams({ format, year }), {
      headers: { Authorization: "Bearer " + jwt.sign({ id: user.id }, process.env.JWT_SECRET) }
    });
    assert.equal((await exportReport(employee, "pdf")).status, 404);
    assert.equal((await exportReport(owner, "html")).status, 400);
    const pdf = await exportReport(owner, "pdf");
    assert.equal(pdf.status, 200);
    assert.equal(Buffer.from(await pdf.arrayBuffer()).subarray(0, 5).toString(), "%PDF-");
    const excel = await exportReport(owner, "xlsx");
    assert.equal(excel.status, 200);
    const cells = (await require("read-excel-file/node").readSheet(Buffer.from(await excel.arrayBuffer()))).flat().join(" ");
    assert.match(cells, /Termin Dekoniki/);
    assert.doesNotMatch(cells, /Obca inwestycja|Odłączone zadanie/);
    const memoryEndpoint = "/business-memory";
    const memory = { kind: "AGREEMENT", text: "Syntetyczne ustalenie", counterparty: "Kontrahent", investmentId: ownedInvestment.id };
    assert.equal((await request(dek, employee, memoryEndpoint)).status, 403);
    assert.equal((await request(dek, owner, memoryEndpoint, "POST", { ...memory, investmentId: foreignInvestment.id })).status, 404);
    const savedMemory = await request(dek, owner, memoryEndpoint, "POST", memory);
    assert.ok([200, 201].includes(savedMemory.status));
    const entryPath = memoryEndpoint + "/" + savedMemory.data.id;
    assert.equal((await request(deh, owner, entryPath, "PUT", { ...memory, investmentId: null })).status, 404);
    assert.equal((await request(deh, owner, entryPath, "DELETE")).status, 404);
    assert.deepEqual((await request(deh, owner, memoryEndpoint)).data.items, []);
    const updatedMemory = await request(dek, owner, entryPath, "PUT", { ...memory, kind: "DECISION", text: "Zmienione ustalenie" });
    assert.equal(updatedMemory.data.kind, "DECISION");
    assert.equal((await request(dek, owner, memoryEndpoint)).data.items[0].text, "Zmienione ustalenie");
    assert.equal((await request(dek, owner, entryPath, "DELETE")).status, 200);
    assert.deepEqual((await request(dek, owner, memoryEndpoint)).data.items, []);
    const scopedTask = { title: "Zadanie do przypisania", assigneeUserId: employee.id };
    assert.equal((await request(dek, employee, "/workspace/tasks", "POST", scopedTask)).status, 403);
    assert.equal((await request(dek, owner, "/investments/" + ownedInvestment.id + "/tasks", "POST", scopedTask)).status, 403);
    const assigned = await request(dek, owner, "/workspace/tasks", "POST", scopedTask);
    assert.ok([200, 201].includes(assigned.status));
    const workspace = await request(dek, owner, "/workspace");
    assert.equal(workspace.data.tasks.find(task => task.id === assigned.data.id).metadata.assigneeUserId, employee.id);
    console.log("Business memory E2E: write, correction, removal and cross-company denial");
    console.log("Owner briefing E2E: ownership, company-scoped investment tasks and deduplicated alerts");
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
    assert.equal(paid.forecast[0].operatingBalanceFromImports,"1090.00");
    assert.equal(paid.forecast[0].vatBalanceFromImports,"23.00");
    assert.equal(paid.forecast[0].projectedMonthEnd,"1120.00");
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
      investmentIds:context.investmentIds,financialSources:context.financialSources}),true);
    await db.organizationInvestment.updateMany({where:{organizationId:dek.id},data:{assignedUserIds:[]}});
    assert.equal(await sources.authorize({userId:employee.id,organizationId:dek.id,agentKey:"financial",
      investmentIds:context.investmentIds,financialSources:context.financialSources}),false);
    const dbReport=new OrganizationSettlementService({db});
    const historic=await dbReport.report(owner.id,dek.id,year,lastMonth);
    assert.equal(historic.items.length,0);
    assert.equal((await request(dek,owner,root+"/payments/"+vat.id,"DELETE")).status,200);
    assert.equal(item(await report(),invoice.id).status,"PARTIAL");
    assert.equal((await request(dek,owner,root+"/corrections/"+correction.id,"DELETE")).status,200);
    assert.equal(item(await report(),invoice.id).outstanding,"33.00");
    const topup=await operation(dek,"CURRENT",10,"Dopłata "+n);
    assert.equal((await pay(owner,invoice.id,topup.id)).status,200);
    assert.equal((await pay(owner,invoice.id,vat.id)).status,200);
    assert.equal((await request(dek,owner,corrections,"POST",{correctionId:correction.id})).status,200);
    assert.equal(item(await report(),invoice.id).overpayment,"10.00");
    const refund=await operation(dek,"CURRENT",-10,"Zwrot KOR/289/"+year);
    const expenses=await request(dek,employee,"/bank/activity/"+year+"/"+month+"?direction=outflows&currency=PLN");
    assert.deepEqual(expenses.data.items.map(row=>[row.id,row.amount]),[[refund.id,"-10.00"]]);
    if(process.env.PRZEMAI_P1_BROWSER==="true")await checkChart(dek,
      jwt.sign({id:owner.id},process.env.JWT_SECRET),endpoint,year,month);
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
