"use strict";
const prisma=require("../../lib/prisma");
const {OrganizationError}=require("./OrganizationService");
const {OrganizationFinanceService,ksefDocPredicate}=require("./OrganizationFinanceService");
const {OrganizationBankAccessService}=require("./OrganizationBankAccessService");
const {suggestMatches,MAX_INVOICES,MAX_OPERATIONS}=require("./BankKsefMatchEngine");

class OrganizationBankKsefMatchService{
 constructor({db=prisma,finance=new OrganizationFinanceService({db}),
  bankAccess=new OrganizationBankAccessService({db})}={}){
  this.db=db;this.finance=finance;this.bankAccess=bankAccess;
 }
 async review(userId,organizationId,yearInput){
  // Both permissions MUST be checked: a KSeF link alone must not
  // reveal bank transactions, and a bank grant cannot reveal KSeF.
  const link=await this.finance.accessible(userId,organizationId);
  await this.bankAccess.authorize(userId,organizationId);
  const year=Number(yearInput);
  if(!Number.isInteger(year)||year<2020||year>2100)
   throw new OrganizationError("Nieprawidłowy rok rozliczenia (2020–2100).",400);
  if(!/^\d{10}$/.test(link.nip))
   throw new OrganizationError("Brak potwierdzonego NIP tej spółki.",400);
  const from=new Date(Date.UTC(year,0,1));
  const next=new Date(Date.UTC(year+1,0,1));
  const payUntil=new Date(Date.UTC(year+1,5,30));
  const [invoices,operations]=await Promise.all([
   this.db.financialDocument.findMany({
    where:{AND:[ksefDocPredicate(link.ownerUserId,link.nip),
     {issueDate:{gte:from,lt:next}},{grossAmount:{not:null}}]},
    select:{id:true,source:true,direction:true,invoiceNumber:true,
     issueDate:true,
     grossAmount:true,currency:true,sellerName:true,buyerName:true,
     sellerNip:true,buyerNip:true},
    orderBy:[{issueDate:"asc"},{id:"asc"}],take:MAX_INVOICES+1
   }),
   this.db.bankTransaction.findMany({
    where:{organizationId,bookedAt:{gte:from,lt:payUntil},
     reviewStatus:"UNMATCHED"},
    select:{id:true,organizationId:true,bookedAt:true,amount:true,
     description:true,counterparty:true,reference:true,reviewStatus:true,
     bankAccount:{select:{currency:true,accountType:true,iban:true}}},
    orderBy:[{bookedAt:"asc"},{id:"asc"}],take:MAX_OPERATIONS+1
   })
  ]);
  if(invoices.length>MAX_INVOICES||operations.length>MAX_OPERATIONS)
   throw new OrganizationError("Za dużo danych w raporcie. Import i rozliczenie wymagają podziału na mniejsze partie.",413);
  const result=suggestMatches(invoices,operations,link.nip);
  return {organizationId,year,source:"KSEF_BANK_SUGGESTIONS",...result};
 }
}
module.exports={OrganizationBankKsefMatchService};
