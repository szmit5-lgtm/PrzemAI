"use strict";

const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const { once } = require("node:events");

function account(suffix) {
  const body = "00000000000000000000" + suffix;
  const checksum = String(98n - BigInt(body + "252100") % 97n).padStart(2, "0");
  return (checksum + body).replace(/^(\d{2})(.*)$/, (_, head, rest) =>
    head + " " + rest.match(/.{4}/g).join(" "));
}

async function main() {
  const url = new URL(process.env.DATABASE_URL);
  assert.equal(url.protocol, "postgresql:");
  assert.equal(url.hostname, "127.0.0.1");
  assert.match(url.pathname, /^\/przemai_p0_e2e_[a-z0-9_]+$/);
  const prisma = require("../lib/prisma");
  const jwt = require("jsonwebtoken");
  const express = require("express");
  const { chromium } = require("playwright");
  const GeneralAgentSources = require("../api/services/GeneralAgentSources");
  process.env.JWT_SECRET = randomUUID();
  const app = express();
  app.use(express.json());
  app.use("/organizations", require("../api/routes/organizationRoutes"));
  const server = app.listen(0, "127.0.0.1");
  let browser;
  try {
    await once(server, "listening");
    const [owner, employee] = await Promise.all(["owner", "employee"].map(role => prisma.user.create({
      data: { email: role + "-" + randomUUID() + "@example.test", password: "synthetic" }
    })));
    const companies = await Promise.all([["Dekonica", "1111111111"], ["Deherus", "2222222222"]]
      .map(([name, nip]) => prisma.organization.create({data:{
        name, slug: name.toLowerCase()+"-"+randomUUID(),
        memberships:{create:[
          {userId:owner.id,role:"OWNER"},
          {userId:employee.id,role:"MEMBER",financeAccess:name==="Dekonica"}
        ]},
        financeLink:{create:{ownerUserId:owner.id,nip}}
      }, include:{financeLink:true}})));
    const [dekonica, deherus] = companies;
    const request = async (user, company, path, options = {}) => {
      const headers = {Authorization:"Bearer "+jwt.sign({id:user.id},process.env.JWT_SECRET)};
      if(typeof options.body==="string")headers["Content-Type"]="application/json";
      const response = await fetch("http://127.0.0.1:"+server.address().port+
        "/organizations/"+company.id+path,{...options,headers});
      return {status:response.status,body:await response.json()};
    };
    const upload = (user, company, filename, bytes) => {
      const body = new FormData();
      body.set("file",new Blob([bytes]),filename);
      return request(user,company,"/bank/files",{method:"POST",body});
    };
    const iban = account("0001");
    const csv = "Rachunek własny;"+iban+"\nWaluta;PLN\nData;Kwota;Opis;Kontrahent\n"+
      "2026-09-08;100,00;Zwrot KOR/1234/2026;Klient E2E\n2026-09-09;-35,00;FV E2E;Dostawca E2E";
    assert.equal((await upload(employee,dekonica,"history.csv",csv)).status,403);
    const first = await upload(owner,dekonica,"history.csv",csv);
    assert.equal(first.body.item?.status,"IMPORTED",JSON.stringify(first.body));
    assert.equal((await upload(owner,dekonica,"history.csv",csv)).body.alreadySaved,true);
    assert.equal((await upload(owner,dekonica,"overlap.csv",csv+"\n")).body.item.status,"REVIEW_REQUIRED");

    browser = await chromium.launch({executablePath:process.env.PRZEMAI_CHROMIUM,
      args:["--no-sandbox"],headless:true});
    const page = await browser.newPage();
    await page.setContent('<meta charset="utf-8"><pre>'+[
      "NR WYCIĄGU  31-10-2026  01-10-2026  31-10-2026  2026/015",
      "WYCIĄG Z RACHUNKU BANKOWEGO",
      account("0002"),
      "Rachunek VAT PLN Liczba pozycji 1",
      "Saldo początkowe: 20,00",
      "1 07-10-2026 Operacja VAT E2E 50,00 70,00",
      "Saldo końcowe: 70,00"
    ].join("\n")+"</pre>");
    const pdf = await page.pdf();
    const vat = await upload(owner,dekonica,"wyciag.pdf",pdf);
    assert.equal(vat.body.item?.status,"IMPORTED",JSON.stringify(vat.body));
    assert.equal((await upload(owner,dekonica,"wyciag.pdf",pdf)).body.alreadySaved,true);

    const bank = (await request(employee,dekonica,"/bank/monthly/2026")).body.data;
    assert.equal(bank.months[9].currencies[0].vatBalance,"70.00");
    assert.equal(bank.months[9].currencies[0].currentBalance,null);
    assert.equal(bank.quarters[2].currencies[0].inflows,"100.00");
    assert.equal(bank.quarters[2].currencies[0].outflows,"35.00");
    assert.equal(bank.quarters[2].counterparties.find(row=>row.counterparty==="Klient E2E").inflows,"100.00");
    assert.equal((await request(employee,deherus,"/bank/monthly/2026")).status,403);
    assert.equal((await request(owner,deherus,"/bank/files/"+vat.body.item.id,{method:"DELETE"})).status,404);
    assert.equal((await request(employee,dekonica,"/bank/files/"+vat.body.item.id,{method:"DELETE"})).status,403);
    const removed = await request(owner,dekonica,"/bank/files/"+vat.body.item.id,{method:"DELETE"});
    assert.equal(removed.body.data?.removedTransactions,1,JSON.stringify(removed.body));
    assert.equal(await prisma.bankTransaction.count({where:{organizationId:dekonica.id}}),2);

    const tag=randomUUID();
    const inputs=Array.from({length:32},(_,index)=>({
      userId:owner.id,source:"KSEF",direction:"INCOMING",buyerNip:dekonica.financeLink.nip,
      sellerNip:"9999999999",invoiceNumber:index===0?"FV/OLD/"+tag:"FV E2E "+index,
      externalId:tag+"-"+index,issueDate:new Date(Date.UTC(2026,0,index+1)),grossAmount:index===31?-25:100
    }));
    await prisma.financialDocument.createMany({data:[
      ...inputs,{...inputs[0],buyerNip:deherus.financeLink.nip,externalId:tag+"-deherus",
        invoiceNumber:"DEHERUS-E2E",grossAmount:9000}
    ]});
    const invoice=await prisma.financialDocument.findFirst({where:{externalId:inputs[0].externalId}});
    const [validProject,foreignProject] = await Promise.all(companies.map(company => prisma.project.create({
      data:{name:"Inwestycja "+company.name,company:company.name,userId:owner.id}
    })));
    const assign=(user,project)=>request(user,dekonica,"/finance/documents/"+invoice.id+"/project",{
      method:"PATCH",body:JSON.stringify({projectId:project.id})
    });
    assert.equal((await assign(employee,validProject)).status,403);
    assert.equal((await assign(owner,foreignProject)).status,404);
    assert.equal((await assign(owner,validProject)).body.data?.projectId,validProject.id);
    const sources=new GeneralAgentSources(prisma);
    const scope={userId:employee.id,organizationId:dekonica.id,agentKey:"financial"};
    const all=await sources.load(scope,"Podsumuj finanse 2026");
    assert.equal(all.invoices.length,25);
    assert.equal(all.invoiceTotals.reduce((sum,row)=>sum+row.count,0),32);
    assert.equal(all.invoiceTotals.reduce((sum,row)=>sum+Number(row.gross),0),3075);
    assert.doesNotMatch(JSON.stringify(all),/DEHERUS-E2E/);
    const exact=await sources.load(scope,"Pokaż "+inputs[0].invoiceNumber);
    assert.equal(exact.invoices[0]?.invoice,inputs[0].invoiceNumber);
    assert.equal(await sources.load({...scope,organizationId:deherus.id},"Faktury"),null);
    const correction=await prisma.financialDocument.create({data:{
      ...inputs[0],externalId:tag+"-correction",invoiceNumber:"KOR/1234/2026",
      issueDate:new Date("2026-09-01"),grossAmount:-100
    }});
    const suggestions=await request(employee,dekonica,"/finance/bank-matches/2026");
    const refund=suggestions.body.data?.proposed.find(row=>row.invoiceId===correction.id);
    assert.equal(refund?.transactionAmount,"100.00",JSON.stringify(suggestions.body));
    assert.equal(refund.verifiedPayment,false);
    await prisma.bankTransaction.updateMany({
      where:{organizationId:dekonica.id,amount:100},data:{reviewStatus:"CONFIRMED"}
    });
    assert.equal((await request(owner,dekonica,"/bank/files/"+first.body.item.id,{method:"DELETE"})).status,409);
    assert.equal(await prisma.bankTransaction.count({where:{organizationId:dekonica.id}}),2);
    await prisma.organizationMembership.updateMany({where:{userId:employee.id,organizationId:dekonica.id},
      data:{financeAccess:false}});
    assert.equal(await sources.load(scope,"Faktury"),null);
    console.log("Financial P0 PostgreSQL E2E passed");
  } finally {
    await browser?.close();
    server.close();
    await prisma.$disconnect();
  }
}

main().catch(error=>{console.error(error);process.exitCode=1;});
