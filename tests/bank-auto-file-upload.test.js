"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {parseBankCsv,parseAmount,iban}=require("../api/services/BankFileParser");
const {BankFileUploadService,fileType}=require("../api/services/BankFileUploadService");

const validIban="PL61109010140000071219812874";
const completeCsv=[
 "Numer rachunku;"+validIban,
 "Waluta;PLN",
 "Saldo początkowe;100,00",
 "Saldo końcowe;90,00",
 "Nr wyciągu;11/2026",
 "Data operacji;Kwota;Opis operacji;Kontrahent",
 "21.11.2026;-20,00;Zakup materiałów;Hurtownia",
 "22.11.2026;10,00;Zwrot;Kontrahent"
].join("\r\n");
const simpleCsv=[
 "Data księgowania;Kwota;Tytuł płatności",
 "21.11.2026;-20,00;Zakup",
 "22.11.2026;12,00;Zwrot"
].join("\n");
const file=(csv,name="bank.csv")=>({
 originalname:name,buffer:Buffer.from(csv,"utf8"),
 size:Buffer.byteLength(csv,"utf8"),mimetype:"text/csv"
});

test("CSV parser recognizes Polish bank dates, amounts, IBAN, balances and exact reconciliation",()=>{
 const result=parseBankCsv(Buffer.from(completeCsv,"utf8"));
 assert.equal(result.account,validIban);
 assert.equal(result.currency,"PLN");
 assert.equal(result.transactionCount,undefined);
 assert.equal(result.extractedCount,2);
 assert.equal(result.periodStart,"2026-11-21");
 assert.equal(result.periodEnd,"2026-11-22");
 assert.equal(result.openingBalance,"100.00");
 assert.equal(result.closingBalance,"90.00");
 assert.equal(result.balanceIssue,false);
 assert.equal(result.transactions[0].amount,"-20.00");
 assert.equal(result.transactions[0].description,"Zakup materiałów");
 assert.equal(result.transactions[1].amount,"10.00");
});

test("CSV parser recognizes rows even if metadata is missing, without inventing the bank account",()=>{
 const result=parseBankCsv(Buffer.from(simpleCsv));
 assert.equal(result.account,null);
 assert.equal(result.currency,null);
 assert.equal(result.extractedCount,2);
 assert.equal(result.openingBalance,null);
 assert.equal(result.closingBalance,null);
});

test("invalid account checksum and invalid row dates are rejected",()=>{
 assert.equal(iban("PL00109010140000071219812874"),null);
 assert.equal(iban(validIban),validIban);
 assert.throws(()=>parseBankCsv(Buffer.from(
  "Rachunek;PL00109010140000071219812874\n"+
  "Data operacji;Kwota;Opis\n21.11.2026;-10,00;Koszt"
  )),/IBAN/);
 assert.throws(()=>parseBankCsv(Buffer.from(
  "Data operacji;Kwota;Opis\n31.02.2026;-10,00;Koszt"
  )),/daty operacji/i);
 assert.deepEqual(parseAmount("1 234,56"),{amount:"1234.56",cents:123456n});
 assert.equal(parseAmount("25,001"),null);
});

function harness({role="OWNER",currency=null}={}){
 const calls={access:[],bankStatements:[],bankTransactions:[],files:[],updates:[],downloads:[]};
 const stored=[];
 const db={
  bankImportFile:{
   async findFirst({where}){
    if(where.id)return stored.find(x=>x.id===where.id&&x.organizationId===where.organizationId)||null;
    return stored.find(x=>x.organizationId===where.organizationId&&x.sha256===where.sha256)||null;
   },
   async findMany({where}){return stored.filter(x=>x.organizationId===where.organizationId);},
   async aggregate(){return {_count:{_all:stored.length},_sum:{size:stored.reduce((a,x)=>a+x.size,0)}};},
   async create({data}){
    const row={id:"f"+(stored.length+1),uploadedAt:new Date("2026-11-21T12:00:00Z"),...data};
    stored.push(row);calls.files.push(row);return row;
   },
   async update({where,data}){
    const row=stored.find(x=>x.id===where.id);
    Object.assign(row,data);calls.updates.push({where,data});return row;
   }
  },
  bankAccount:{
   async upsert({create}){
    return {id:"bank1",currency:currency||create.currency,organizationId:create.organizationId};
   }
  },
  bankStatement:{
   async findFirst(){return null;},
   async create({data}){
    calls.bankStatements.push(data);return {id:"statement1",...data};
   }
  },
  bankTransaction:{
   async createMany({data}){calls.bankTransactions.push(...data);return {count:data.length};}
  }
 };
 db.$transaction=async operation=>operation(db);
 const access={async authorize(userId,orgId,options){
  calls.access.push({userId,orgId,options});
  if(role!=="OWNER")throw Object.assign(new Error("Brak dostępu."),{status:403});
 }};
 return {service:new BankFileUploadService({db,access,pdfParser:async()=>({numpages:1,text:"Przykładowy PDF tekstowy: dokument wyciągu bankowego i operacje"})}),calls,stored};
}
test("one upload automatically imports a complete verified CSV without a manual form",async()=>{
 const {service,calls,stored}=harness();
 const result=await service.upload("owner","dekonica",file(completeCsv));
 assert.equal(result.alreadySaved,false);
 assert.equal(result.item.status,"IMPORTED");
 assert.equal(result.item.transactionCount,2);
 assert.equal(calls.bankStatements.length,1);
 assert.equal(calls.bankTransactions.length,2);
 assert.equal(calls.bankStatements[0].organizationId,"dekonica");
 assert.equal(calls.bankStatements[0].sourceType,"CSV_EXPORT");
 assert.equal(calls.bankStatements[0].openingBalance,"100.00");
 assert.equal(calls.bankStatements[0].closingBalance,"90.00");
 assert.equal(calls.bankTransactions[0].amount,"-20.00");
 assert.equal(stored[0].content.equals(Buffer.from(completeCsv)),true);
 const again=await service.upload("owner","dekonica",file(completeCsv));
 assert.equal(again.alreadySaved,true);
 assert.equal(calls.bankStatements.length,1);
});

test("a CSV with no account is saved for review, never assigned an invented account",async()=>{
 const {service,calls,stored}=harness();
 const result=await service.upload("owner","dekonica",file(simpleCsv));
 assert.equal(result.item.status,"REVIEW_REQUIRED");
 assert.equal(result.item.transactionCount,2);
 assert.match(result.item.note,/numeru rachunku/);
 assert.equal(calls.bankStatements.length,0);
 assert.equal(calls.bankTransactions.length,0);
 assert.equal(stored[0].organizationId,"dekonica");
 assert.equal(stored[0].parsedRows.length,2);
});

test("PDF original is accepted with review status and no fabricated bank transactions",async()=>{
 const {service,calls}=harness();
 const pdf={originalname:"wyciag.pdf",buffer:Buffer.from("%PDF-1.7\nFAKE PDF bytes to mock pdf parser"),
  mimeType:"application/pdf"};
 pdf.size=pdf.buffer.length;
 const result=await service.upload("owner","deherus",pdf);
 assert.equal(result.item.status,"REVIEW_REQUIRED");
 assert.match(result.item.note,/PDF zapisany/);
 assert.equal(calls.bankTransactions.length,0);
 assert.equal(calls.files[0].organizationId,"deherus");
});

test("bank upload read and write are restricted to company OWNER",async()=>{
 const {service,calls}=harness({role:"MEMBER"});
 await assert.rejects(service.upload("leszek","dekonica",file(completeCsv)),/Brak dostępu/);
 await assert.rejects(service.list("leszek","dekonica"),/Brak dostępu/);
 await assert.rejects(service.download("leszek","dekonica","f1"),/Brak dostępu/);
 assert.equal(calls.files.length,0);
});
test("same bank statement CSV is independent in two organizations",async()=>{
 const {service,stored,calls}=harness();
 await service.upload("owner","dekonica",file(completeCsv));
 await service.upload("owner","deherus",file(completeCsv));
 assert.equal(stored.length,2);
 assert.deepEqual(calls.bankStatements.map(x=>x.organizationId),["dekonica","deherus"]);
});
test("bank uploads do not accept invalid PDF or executable masquerading as CSV",()=>{
 assert.throws(()=>fileType({originalname:"fake.pdf",buffer:Buffer.from("not pdf")}),/PDF/);
 assert.throws(()=>fileType({originalname:"x.exe",buffer:Buffer.from("abc")}),/CSV lub PDF/);
 assert.throws(()=>fileType({originalname:"x.csv",buffer:Buffer.from([0x4d,0x5a,0x00])}),/CSV/);
});
