"use strict";
const crypto=require("node:crypto");
const pdfParse=require("pdf-parse");
const prisma=require("../../lib/prisma");
const {OrganizationBankAccessService}=require("./OrganizationBankAccessService");
const {OrganizationError}=require("./OrganizationService");
const {parseBankCsv,parseAmount}=require("./BankFileParser");

const MAX_FILES=120;
const MAX_BYTES=240*1024*1024;
const CSV_MAX=2*1024*1024;
const PDF_MAX=15*1024*1024;
const PUBLIC_SELECT={id:true,name:true,mimeType:true,size:true,status:true,
  note:true,transactionCount:true,statementId:true,uploadedAt:true};

const bankAccess=new OrganizationBankAccessService();
function fileType(file) {
 const name=String(file?.originalname||"");
 const ext=name.toLowerCase().split(".").pop();
 if(ext!=="csv"&&ext!=="pdf")throw new OrganizationError("Można wczytać tylko plik CSV lub PDF.",400);
 const max=ext==="csv"?CSV_MAX:PDF_MAX;
 if(!file?.buffer?.length||file.buffer.length>max)
  throw new OrganizationError("Plik jest pusty lub przekracza limit "+(ext==="csv"?"2 MB":"15 MB")+".",400);
 if(ext==="pdf"&&file.buffer.subarray(0,5).toString("ascii")!=="%PDF-")
  throw new OrganizationError("Plik nie jest poprawnym PDF.",400);
 if(ext==="csv"&&(file.buffer.includes(0)||file.buffer.subarray(0,2).equals(Buffer.from([0x4d,0x5a]))))
  throw new OrganizationError("Wybrano nieprawidłowy plik CSV.",400);
 return ext;
}
function safeName(name) {
 const clean=String(name||"").replace(/[\\/\x00-\x1f\x7f]/g,"_").trim();
 if(!clean||clean.length>255)throw new OrganizationError("Nieprawidłowa nazwa pliku.",400);
 return clean;
}
function normalizedRow(row,index,orgId,bankAccountId,statementId){
 const bookedAt=new Date(row.date+"T12:00:00.000Z");
 const data={organizationId:orgId,bankAccountId,bankStatementId:statementId,
  bookedAt,amount:row.amount,
  description:row.description,counterparty:row.counterparty||null,reference:row.reference||null};
 const fingerprint=crypto.createHash("sha256").update(JSON.stringify([
  index,row.date,row.amount,row.description,row.counterparty||"",row.reference||""
 ])).digest("hex");
 return {...data,fingerprint};
}
class BankFileUploadService {
 constructor({db=prisma,access=bankAccess,pdfParser=pdfParse}={}){
  this.db=db;this.access=access;this.pdfParser=pdfParser;
 }
 async list(userId,organizationId){
  await this.access.authorize(userId,organizationId,{ownerOnly:true});
  const items=await this.db.bankImportFile.findMany({
   where:{organizationId},select:PUBLIC_SELECT,
   orderBy:[{uploadedAt:"desc"},{id:"desc"}],take:MAX_FILES
  });
  return {items};
 }
 async download(userId,organizationId,fileId){
  await this.access.authorize(userId,organizationId,{ownerOnly:true});
  const item=await this.db.bankImportFile.findFirst({
   where:{id:fileId,organizationId},
   select:{name:true,mimeType:true,content:true}
  });
  if(!item)throw new OrganizationError("Nie znaleziono pliku w tej spółce.",404);
  return item;
 }
 async upload(userId,organizationId,file){
  await this.access.authorize(userId,organizationId,{ownerOnly:true});
  const ext=fileType(file);
  const name=safeName(file.originalname);
  const sha256=crypto.createHash("sha256").update(file.buffer).digest("hex");
  const existing=await this.db.bankImportFile.findFirst({
   where:{organizationId,sha256},select:PUBLIC_SELECT
  });
  if(existing)return {item:existing,alreadySaved:true};
  const stats=await this.db.bankImportFile.aggregate({
   where:{organizationId},_count:{_all:true},_sum:{size:true}
  });
  if(stats._count._all>=MAX_FILES||(stats._sum.size||0)+file.buffer.length>MAX_BYTES)
   throw new OrganizationError("Biblioteka wyciągów osiągnęła limit plików lub miejsca.",413);

  let parsed=null,reason="",count=0;
  if(ext==="csv"){
   try{
    parsed=parseBankCsv(file.buffer);
    count=parsed.extractedCount;
    if(parsed.balanceIssue)reason="Saldo początkowe i końcowe nie zgadzają się z sumą operacji. Nie zapisano transakcji w banku.";
    else if(!parsed.account)reason="Odczytano operacje, ale w pliku nie ma jednoznacznego numeru rachunku firmowego.";
    else if(!parsed.currency)reason="Odczytano operacje, ale w pliku nie określono waluty rachunku.";
    else if(!/^[A-Z]{3}$/.test(parsed.currency))reason="Nierozpoznana waluta wyciągu.";
   }catch(error){
    reason="Plik zapisano, ale nie można bezpiecznie odczytać wszystkich operacji: "+(error?.message||"nieznany format CSV");
   }
  }else{
   try{
    const data=await this.pdfParser(file.buffer,{max:120});
    const pageCount=Number(data?.numpages)||0;
    const foundText=String(data?.text||"").trim().length>40;
    reason=foundText
     ?"PDF zapisany ("+pageCount+" str.). Ten format wymaga jeszcze dopasowania odczytu operacji do banku; nie utworzono fikcyjnych transakcji."
     :"PDF zapisany, ale nie zawiera tekstu możliwego do odczytania. Skan wymaga dodatkowego rozpoznawania.";
   }catch{
    reason="PDF zapisany. Automatyczne wydobycie operacji z tego formatu nie powiodło się.";
   }
  }

  let created;
  try{
   created=await this.db.bankImportFile.create({
    data:{organizationId,uploadedById:userId,name,size:file.buffer.length,
     mimeType:ext==="csv"?"text/csv":"application/pdf",
     sha256,content:file.buffer,status:"PROCESSING",note:null,
     transactionCount:count,parsedRows:parsed?.transactions||undefined},
    select:PUBLIC_SELECT
   });
  }catch(error){
   if(error?.code==="P2002"){
    const found=await this.db.bankImportFile.findFirst({where:{organizationId,sha256},select:PUBLIC_SELECT});
    if(found)return {item:found,alreadySaved:true};
   }
   throw error;
  }
  if(reason || !parsed){
   const item=await this.db.bankImportFile.update({
    where:{id:created.id},data:{status:"REVIEW_REQUIRED",
     note:reason||"Plik jest zapisany, ale nie można odczytać jego operacji."},
    select:PUBLIC_SELECT
   });
   return {item,alreadySaved:false};
  }
  // Explicit account and currency come from the uploaded CSV. A transaction
  // export need not have bank statement opening/closing balances.
  const periodStart=parsed.periodStart,periodEnd=parsed.periodEnd;
  const sum=parsed.transactions.reduce((total,row)=>total+parseAmount(row.amount).cents,0n);
  let balanceStart=parsed.openingBalance,balanceEnd=parsed.closingBalance;
  if((balanceStart===null)!==(balanceEnd===null)){
   balanceStart=null;balanceEnd=null;
  }
  if(balanceStart!==null&&balanceEnd!==null&&
    parseAmount(balanceStart).cents+sum!==parseAmount(balanceEnd).cents){
   const item=await this.db.bankImportFile.update({
    where:{id:created.id},data:{status:"REVIEW_REQUIRED",note:"Salda nie zgadzają się z operacjami; dane zachowano do sprawdzenia."},
    select:PUBLIC_SELECT
   });
   return {item,alreadySaved:false};
  }
  try{
   const statementId=await this.db.$transaction(async tx=>{
    const account=await tx.bankAccount.upsert({
     where:{organizationId_iban:{organizationId,iban:parsed.account}},
     create:{organizationId,iban:parsed.account,currency:parsed.currency},
     update:{}
    });
    if(account.currency!==parsed.currency){
     throw new OrganizationError("Waluta pliku różni się od waluty przypisanego rachunku.",422);
    }
    const old=await tx.bankStatement.findFirst({
     where:{organizationId,bankAccountId:account.id,sourceHash:sha256},
     select:{id:true}
    });
    if(old)throw new OrganizationError("Ten wyciąg jest już zarejestrowany jako transakcje.",409);
    // CSV_IMPORT is a system identifier, not a fabricated bank statement number.
    const statement=await tx.bankStatement.create({
     data:{organizationId,bankAccountId:account.id,
      statementNumber:"CSV_IMPORT_"+sha256.slice(0,16),sourceHash:sha256,
      sourceType:"CSV_EXPORT",openingBalance:balanceStart,closingBalance:balanceEnd,
      periodStart:new Date(periodStart+"T12:00:00.000Z"),
      periodEnd:new Date(periodEnd+"T12:00:00.000Z"),
      importedByUserId:userId,transactionCount:parsed.transactions.length}
    });
    await tx.bankTransaction.createMany({
     data:parsed.transactions.map((row,index)=>
      normalizedRow(row,index,organizationId,account.id,statement.id))
    });
    await tx.bankImportFile.update({
     where:{id:created.id},
     data:{status:"IMPORTED",note:balanceStart===null
      ?"Zaimportowano transakcje. Plik nie podaje obu sald wyciągu; saldo bankowe pozostaje nieznane."
      :"Zaimportowano transakcje i zweryfikowano zgodność sald.",
      statementId:statement.id,parsedRows:null}
    });
    return statement.id;
   });
   const item=await this.db.bankImportFile.findFirst({
    where:{id:created.id,organizationId},select:PUBLIC_SELECT
   });
   return {item,alreadySaved:false,statementId};
  }catch(error){
   // The original upload remains stored, but no partial ledger is committed.
   const issue=error instanceof OrganizationError?error.message:
    "Nie można było bezpiecznie zapisać transakcji. Oryginał pozostaje w bibliotece.";
   const item=await this.db.bankImportFile.update({
    where:{id:created.id},data:{status:"REVIEW_REQUIRED",note:issue},
    select:PUBLIC_SELECT
   });
   return {item,alreadySaved:false};
  }
 }
}
module.exports={BankFileUploadService,fileType,safeName};
