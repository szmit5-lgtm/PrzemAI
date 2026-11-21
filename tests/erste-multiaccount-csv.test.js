"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {parseBankCsv}=require("../api/services/BankFileParser");
const {BankFileUploadService}=require("../api/services/BankFileUploadService");

// Artificial bank identifiers and transactions ONLY. No production statement
// PDFs, bank account numbers or customer details are stored in the repository.
function fakeAccount(last24){
 const check=98n-(BigInt(last24+"252100")%97n);
 return (check.toString().padStart(2,"0")+last24).replace(/(\d{2})(\d{4})(\d{4})(\d{4})(\d{4})(\d{4})(\d{4})/,"$1 $2 $3 $4 $5 $6 $7");
}
const current=fakeAccount("109010140000071219812874");
const vat=fakeAccount("109010140000071219812875");
function row(width,positions) {
 const cells=Array(width).fill("");
 for(const [key,value] of Object.entries(positions))cells[Number(key)]=value;
 return cells.join(";");
}
function printedGroup(account,number,type,opening,closing,amounts,{broken=false}={}){
 const first=row(20,{7:"DATA WYCIĄGU",10:"WYCIĄG OD",13:"DO",18:"NR WYCIĄGU"});
 const period=row(20,{7:"31-10-2026",10:"01-10-2026",13:"31-10-2026",18:number});
 const title=row(20,{0:"WYCIĄG Z RACHUNKU BANKOWEGO"});
 const accountRow=row(20,{7:account});
 const info=row(20,{1:type==="VAT"?"Rachunek VAT":"Rachunek bieżący",5:"PLN",17:String(amounts.length)});
 const head=row(20,{0:"LP.",2:"DATA",4:"OPIS TRANSAKCJI",8:"OBCIĄŻENIA",12:"UZNANIA",15:"SALDO"});
 const openingRow=row(20,{2:"01-10-2026",4:"Saldo początkowe:",16:opening});
 const toCents=x=>BigInt(x.replace(",",".").replace(".",""));
 const money=x=>{
  const n=x<0n?-x:x;
  return (x<0n?"-":"")+(n/100n).toString()+","+(n%100n).toString().padStart(2,"0");
 };
 let running=toCents(opening);
 const transactions=amounts.map((a,i)=>{
  const val=toCents(a);
  running+=val;
  const width=i===0?20:13;
  const idx=width===20?{date:2,desc:4,debit:8,credit:12,balance:16}:
                           {date:1,desc:2,debit:4,credit:6,balance:10};
  return row(width,{0:String(i+1),[idx.date]:"07-10-2026",
   [idx.desc]:"Przykładowa operacja nr "+(i+1)+" - dane testowe",
   [val<0n?idx.debit:idx.credit]:money(val<0n?-val:val),
   [idx.balance]:broken&&i===1?"123,45":money(running)});
 });
 const ending=row(13,{1:"31-10-2026",2:"Saldo końcowe:",10:closing});
 return [first,period,row(20,{7:"NR RACHUNKU"}),title,accountRow,
  row(20,{0:"ODDZIAŁ"}),info,head,openingRow,...transactions,ending].join("\r\n");
}
const sample=printedGroup(current,"2026/009","CURRENT","100,00","95,00",["-20,00","15,00"])+
 "\r\n"+printedGroup(vat,"2026/005","VAT","20,00","65,00",["50,00","-5,00"]);
const bytes=Buffer.from(sample,"utf8");
const sampleFile=()=>({originalname:"syntetyczny-wyciag.csv",buffer:bytes,size:bytes.length,mimetype:"text/csv"});

test("Erste printed CSV contains two independent verified account groups",()=>{
 const result=parseBankCsv(bytes);
 assert.equal(result.format,"ERSTE_PRINTED_CSV");
 assert.equal(result.accounts.length,2);
 assert.equal(result.extractedCount,4);
 const [first,second]=result.accounts;
 assert.equal(first.account.slice(-4),"2874");
 assert.equal(second.account.slice(-4),"2875");
 assert.equal(first.statementNumber,"2026/009");
 assert.equal(second.statementNumber,"2026/005");
 assert.equal(first.openingBalance,"100.00");
 assert.equal(first.closingBalance,"95.00");
 assert.equal(second.openingBalance,"20.00");
 assert.equal(second.closingBalance,"65.00");
 assert.equal(second.accountType,"VAT");
 assert.equal(first.transactions[0].amount,"-20.00");
 assert.equal(first.transactions[1].balanceAfter,"95.00");
 assert.equal(second.transactions[0].amount,"50.00");
});

test("Truncated or modified Erste balances are rejected before creating any ledger entry",()=>{
 const correctEnd=row(13,{1:"31-10-2026",2:"Saldo końcowe:",10:"95,00"});
 const brokenEnd=row(13,{1:"31-10-2026",2:"Saldo końcowe:",10:"99,00"});
 const altered=sample.replace(correctEnd,brokenEnd);
 assert.throws(()=>parseBankCsv(Buffer.from(altered)),/sald|pozycji/i);
 const corrupt=printedGroup(current,"2026/009","CURRENT","100,00","95,00",["-20,00","15,00"],{broken:true});
 assert.throws(()=>parseBankCsv(Buffer.from(corrupt)),/Sald narastających/);
 const dropped=sample.replace("Przykładowa operacja nr 2 - dane testowe","");
 assert.throws(()=>parseBankCsv(Buffer.from(dropped)),/Brak opisu/);
});

function makeDb(){
 const accounts=new Map(),statements=[],transactions=[],files=[];
 const db={
  bankImportFile:{
   async findFirst({where}){return files.find(x=>x.organizationId===where.organizationId&&
    (where.id?x.id===where.id:x.sha256===where.sha256))||null;},
   async findMany({where}){return files.filter(x=>x.organizationId===where.organizationId);},
   async aggregate(){return {_count:{_all:files.length},_sum:{size:files.reduce((n,f)=>n+f.size,0)}};},
   async create({data}){const x={id:"f"+(files.length+1),...data};files.push(x);return x;},
   async update({where,data}){const x=files.find(x=>x.id===where.id);Object.assign(x,data);return x;}
  },
  bankAccount:{
   async upsert({where,create,update}){
    const key=where.organizationId_iban.organizationId+"|"+where.organizationId_iban.iban;
    if(!accounts.has(key))accounts.set(key,{id:"acct"+(accounts.size+1),...create});
    else Object.assign(accounts.get(key),update);
    return accounts.get(key);
   }
  },
  bankStatement:{
   async findFirst({where}){
    return statements.find(x=>x.organizationId===where.organizationId&&
      x.bankAccountId===where.bankAccountId&&
      (where.statementNumber?x.statementNumber===where.statementNumber:x.sourceHash===where.sourceHash))||null;
   },
   async create({data}){const x={id:"stmt"+(statements.length+1),...data};
    statements.push(x);return x;}
  },
  bankTransaction:{async createMany({data}){transactions.push(...data);return {count:data.length};}}
 };
 db.$transaction=async fn=>fn(db);
 const access={async authorize(_user,_org,options){
  assert.equal(options.ownerOnly,true);
 }};
 return {db,access,accounts,statements,transactions,files};
}
test("one file imports CURRENT and VAT as separate statements, with exact balances",async()=>{
 const state=makeDb();
 const service=new BankFileUploadService({db:state.db,access:state.access});
 const out=await service.upload("owner","dekonica",sampleFile());
 assert.equal(out.item.status,"IMPORTED");
 assert.equal(out.item.transactionCount,4);
 assert.equal(state.statements.length,2);
 assert.equal(state.transactions.length,4);
 assert.equal(state.accounts.size,2);
 assert.deepEqual(state.statements.map(x=>x.statementNumber),["2026/009","2026/005"]);
 assert.deepEqual(state.statements.map(x=>x.transactionCount),[2,2]);
 assert.equal(state.transactions[1].balanceAfter,"95.00");
 assert.equal(state.transactions[3].balanceAfter,"65.00");
 assert.ok(state.statements.every(x=>x.organizationId==="dekonica"));
 const repeat=await service.upload("owner","dekonica",sampleFile());
 assert.equal(repeat.alreadySaved,true);
 assert.equal(state.statements.length,2);
});

test("different source CSV with same verified bank statement number cannot duplicate transactions",async()=>{
 const state=makeDb();
 const service=new BankFileUploadService({db:state.db,access:state.access});
 await service.upload("owner","dekonica",sampleFile());
 const other=sampleFile();
 other.buffer=Buffer.from(sample+"\n;");other.size=other.buffer.length;
 const out=await service.upload("owner","dekonica",other);
 assert.equal(out.item.status,"IMPORTED");
 assert.equal(out.importedAccounts,0);
 assert.equal(out.skippedAccounts,2);
 assert.equal(state.transactions.length,4);
});

test("same export can be uploaded to a second company only as its own tenant",async()=>{
 const state=makeDb();
 const service=new BankFileUploadService({db:state.db,access:state.access});
 await service.upload("owner","dekonica",sampleFile());
 const result=await service.upload("owner","deherus",sampleFile());
 assert.equal(result.item.status,"IMPORTED");
 assert.equal(state.statements.length,4);
 assert.deepEqual(state.statements.map(x=>x.organizationId),
  ["dekonica","dekonica","deherus","deherus"]);
});
