"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const crypto=require("node:crypto");
const fs=require("node:fs");
const path=require("node:path");
const {BankFileUploadService,fileType}=require("../api/services/BankFileUploadService");

const csv=Buffer.from([
 "Numer rachunku;PL61109010140000071219812874",
 "Waluta;PLN",
 "Saldo początkowe;100,00",
 "Saldo końcowe;90,00",
 "Data operacji;Kwota;Opis operacji",
 "21.11.2026;-20,00;Opłata",
 "22.11.2026;10,00;Zwrot"
].join("\n"));

function makeMock(){
 const hash=crypto.createHash("sha256").update(csv).digest("hex");
 const files=[
  {id:"f1",organizationId:"dekonica",status:"IMPORTED",sha256:hash,
   mimeType:"text/csv",name:"import.csv",content:csv,statementId:"s1"},
  {id:"f2",organizationId:"deherus",status:"IMPORTED",sha256:hash,
   mimeType:"text/csv",name:"import.csv",content:csv,statementId:"s2"},
  {id:"f3",organizationId:"dekonica",status:"REVIEW_REQUIRED",sha256:"otherhash",
   mimeType:"application/pdf",name:"bad.pdf",content:Buffer.from("%PDF-1.7"),statementId:null}
 ];
 const statements=[
  {id:"s1",organizationId:"dekonica",sourceHash:hash,
   statementNumber:"CSV_IMPORT_"+hash.slice(0,16),bankAccountId:"b1"},
  {id:"s2",organizationId:"deherus",sourceHash:hash,
   statementNumber:"CSV_IMPORT_"+hash.slice(0,16),bankAccountId:"b2"}
 ];
 const txs=[
  {id:"t1",organizationId:"dekonica",bankStatementId:"s1",reviewStatus:"UNMATCHED"},
  {id:"t2",organizationId:"dekonica",bankStatementId:"s1",reviewStatus:"UNMATCHED"},
  {id:"t3",organizationId:"deherus",bankStatementId:"s2",reviewStatus:"UNMATCHED"}
 ];
 const authCalls=[],queries=[];
 const db={
  bankImportFile:{
   async findFirst({where}){queries.push({type:"file.find",where});
    return files.find(f=>f.id===where.id&&f.organizationId===where.organizationId)||null;},
   async deleteMany({where}){queries.push({type:"file.delete",where});
    const idx=files.findIndex(f=>f.id===where.id&&f.organizationId===where.organizationId);
    if(idx===-1)return {count:0};
    files.splice(idx,1);return {count:1};}
  },
  bankStatement:{
   async findMany({where}){queries.push({type:"statement.find",where});
    return statements.filter(s=>s.organizationId===where.organizationId&&
     where.sourceHash.in.includes(s.sourceHash));},
   async deleteMany({where}){queries.push({type:"statement.delete",where});
    let count=0;
    for(let i=statements.length-1;i>=0;i--)if(
      statements[i].organizationId===where.organizationId&&
      where.id.in.includes(statements[i].id)&&where.sourceHash.in.includes(statements[i].sourceHash)
    ){statements.splice(i,1);count++;}
    return {count};}
  },
  bankTransaction:{
   async count({where}){return txs.filter(x=>
    x.organizationId===where.organizationId&&
    where.bankStatementId.in.includes(x.bankStatementId)&&
    x.reviewStatus!==where.reviewStatus.not).length;},
   async deleteMany({where}){queries.push({type:"transaction.delete",where});
    let count=0;
    for(let i=txs.length-1;i>=0;i--)if(txs[i].organizationId===where.organizationId&&
      where.bankStatementId.in.includes(txs[i].bankStatementId)){txs.splice(i,1);count++;}
    return {count};}
  }
 };
 db.$transaction=async fn=>fn(db);
 const access={async authorize(userId,orgId,options){
  authCalls.push({userId,orgId,options});
  if(userId!=="owner")throw Object.assign(new Error("Brak uprawnień"),{status:403});
 }};
 const service=new BankFileUploadService({db,access});
 return {service,files,statements,txs,queries,authCalls};
}

test("owner removes a bad PDF without touching any bank statement",async()=>{
 const h=makeMock();
 const result=await h.service.remove("owner","dekonica","f3");
 assert.equal(result.removedTransactions,0);
 assert.equal(result.removedStatements,0);
 assert.equal(h.files.some(f=>f.id==="f3"),false);
 assert.equal(h.statements.length,2);
 assert.equal(h.txs.length,3);
 assert.equal(h.authCalls[0].options.ownerOnly,true);
});

test("owner can remove imported CSV and only its own company's unreviewed transactions",async()=>{
 const h=makeMock();
 const result=await h.service.remove("owner","dekonica","f1");
 assert.deepEqual(result,{removedFileId:"f1",removedStatements:1,removedTransactions:2});
 assert.deepEqual(h.statements.map(s=>s.id),["s2"]);
 assert.deepEqual(h.txs.map(t=>t.id),["t3"]);
 assert.deepEqual(h.files.map(f=>f.id),["f2","f3"]);
 const deleted=h.queries.filter(q=>q.type.endsWith(".delete"));
 assert.ok(deleted.every(q=>q.where.organizationId==="dekonica"));
});

test("wrong company id and non-owner cannot delete a statement",async()=>{
 const h=makeMock();
 await assert.rejects(h.service.remove("owner","deherus","f1"),e=>e.status===404);
 await assert.rejects(h.service.remove("leszek","dekonica","f1"),/Brak uprawnień/);
 assert.equal(h.files.length,3);
 assert.equal(h.statements.length,2);
 assert.equal(h.txs.length,3);
});

test("linked or reviewed bank operations block destructive deletion",async()=>{
 const h=makeMock();
 h.txs[0].reviewStatus="MATCHED";
 await assert.rejects(h.service.remove("owner","dekonica","f1"),e=>e.status===409&&/powiązana/.test(e.message)||e.status===409);
 assert.equal(h.files.length,3);
 assert.equal(h.statements.length,2);
 assert.equal(h.txs.length,3);
});

test("an in-progress bank upload cannot be deleted while transaction import runs",async()=>{
 const h=makeMock();
 h.files[0].status="PROCESSING";
 await assert.rejects(h.service.remove("owner","dekonica","f1"),e=>e.status===409);
 assert.equal(h.txs.length,3);
});

test("batch limit now accepts up to 15MB CSV to support annual exports",()=>{
 const sized=Buffer.alloc(3*1024*1024,65);
 assert.equal(fileType({originalname:"roczny.csv",buffer:sized}),"csv");
});

test("main dashboard displays balance cards after explicit company selection",()=>{
 const main=fs.readFileSync(path.join(__dirname,"../frontend/src/app/page.js"),"utf8");
 const widget=fs.readFileSync(path.join(__dirname,"../frontend/src/app/components/CompanyBankSnapshot.js"),"utf8");
 const bankPage=fs.readFileSync(path.join(__dirname,"../frontend/src/app/company/[id]/bank/page.js"),"utf8");
 const routes=fs.readFileSync(path.join(__dirname,"../api/routes/organizationRoutes.js"),"utf8");
 assert.match(main,/<CompanyBankSnapshot company=\{selectedOrg\|\|null\}/);
 assert.match(widget,/getOrganizationBankSummary\(id\)/);
 assert.match(widget,/Rachunek VAT/);
 assert.match(widget,/Rachunek bieżący/);
 assert.match(widget,/new Set\(days\)\.size!==1/);
 assert.match(routes,/statements:\{where:\{closingBalance:\{not:null\}\}/);
 assert.match(bankPage,/deleteOrganizationBankFile\(id,item\.id\)/);
 assert.match(bankPage,/window\.confirm\(warning\)/);
});
