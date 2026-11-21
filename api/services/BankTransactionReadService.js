"use strict";
const prisma=require("../../lib/prisma");
const {OrganizationError}=require("./OrganizationService");

async function listBankTransactions(userId,organizationId,options={},db=prisma){
 const membership=await db.organizationMembership.findFirst({
  where:{userId,organizationId,status:"ACTIVE",organization:{status:"ACTIVE"}},
  select:{role:true,financeAccess:true}
 });
 if(!membership||membership.role!=="OWNER"&&!membership.financeAccess)
  throw new OrganizationError("Nie masz dostępu do finansów tej firmy.",403);
 const limit=options.limit===undefined?50:Number(options.limit);
 const offset=options.offset===undefined?0:Number(options.offset);
 if(!Number.isInteger(limit)||limit<1||limit>100||!Number.isInteger(offset)||offset<0||offset>100000)
  throw new OrganizationError("Nieprawidłowe parametry stronicowania.",400);
 const where={organizationId};
 if(options.accountId!==undefined){
  if(typeof options.accountId!=="string"||options.accountId.length<1||options.accountId.length>128)
   throw new OrganizationError("Nieprawidłowy rachunek.",400);
  where.bankAccountId=options.accountId;
 }
 const records=await db.bankTransaction.findMany({
  where,skip:offset,take:limit+1,
  orderBy:[{bookedAt:"desc"},{id:"desc"}],
  select:{id:true,bookedAt:true,amount:true,description:true,counterparty:true,reference:true,
   reviewStatus:true,bankAccount:{select:{label:true,iban:true}}}
 });
 return {items:records.slice(0,limit).map(r=>({
  id:r.id,bookedAt:r.bookedAt,amount:r.amount.toString(),
  description:r.description,counterparty:r.counterparty,reference:r.reference,
  reviewStatus:r.reviewStatus,
  accountLabel:r.bankAccount.label,ibanSuffix:r.bankAccount.iban.slice(-4)
 })),hasMore:records.length>limit,limit,offset};
}
module.exports={listBankTransactions};
