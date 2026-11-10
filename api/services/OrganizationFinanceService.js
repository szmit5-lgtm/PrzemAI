"use strict";
const prisma=require("../../lib/prisma");
const {OrganizationService,OrganizationError}=require("./OrganizationService");
const NIP=/^\d{10}$/;
const DEHERUS_NIP="1133200454";
function isDeherus(org){return /(?:deherus|(?:^|\W)m1(?:\W|$))/i.test((org?.name||"")+" "+(org?.slug||"")+" "+(org?.displayName||""));}
function ksefDocPredicate(ownerUserId,nip){
  return {userId:ownerUserId,source:"KSEF",
    OR:[{buyerNip:nip},{sellerNip:nip}]};
}
function normalizePageNumber(value,defaultValue,max){
  const n=value===undefined?defaultValue:Number(value);
  if(!Number.isInteger(n)||n<0||n>max)
    throw new OrganizationError("Nieprawidłowe parametry stronicowania.",400);
  return n;
}
class OrganizationFinanceService{
 constructor({db=prisma,orgService=null,env=process.env}={}){
  this.db=db;this.env=env;
  this.orgService=orgService||new OrganizationService({db});
 }
 async accessible(userId,organizationId){
   await this.orgService.membership(userId,organizationId);
   const link=await this.db.organizationFinanceLink.findUnique({
     where:{organizationId},select:{id:true,organizationId:true,ownerUserId:true,nip:true}
   });
   if(!link)throw new OrganizationError("KSeF nie został jeszcze połączony z tą firmą.",404);
   if(link.ownerUserId!==userId){
     // Re-read permission from the membership row. Do not infer access from
     // company administrator or membership role.
     const permitted=await this.db.organizationMembership.findFirst({
       where:{userId,organizationId,status:"ACTIVE",financeAccess:true,
         organization:{status:"ACTIVE"}},
       select:{id:true,userId:true,organizationId:true,financeAccess:true}
     });
     if(!permitted || permitted.userId!==userId || permitted.organizationId!==organizationId)
       throw new OrganizationError("Nie masz dostępu do finansów tej firmy.",403);
   }
   return link;
 }
 async linkStatus(userId,organizationId){
   const member=await this.orgService.membership(userId,organizationId);
   const link=await this.db.organizationFinanceLink.findUnique({
     where:{organizationId},select:{id:true,ownerUserId:true}
   });
   const explicit=link?.ownerUserId===userId||Boolean((await this.db.organizationMembership.findFirst({
     where:{userId,organizationId,status:"ACTIVE",financeAccess:true,
       organization:{status:"ACTIVE"}},
     select:{id:true}
   }))?.id);
   const pilotOrg=await this.db.organization.findUnique({
     where:{id:organizationId},select:{name:true,slug:true,displayName:true,status:true}
   });
   const deherus=isDeherus(pilotOrg);
   const configuredNip=deherus?this.env.KSEF_DEHERUS_NIP:this.env.KSEF_NIP;
   const couldLink=pilotOrg?.status==="ACTIVE"&&
     (deherus?configuredNip===DEHERUS_NIP&&Boolean(this.env.KSEF_DEHERUS_TOKEN):/dekonica/i.test((pilotOrg?.name||"")+" "+(pilotOrg?.slug||"")))&&
     member.role==="OWNER"&&
     userId===this.env.KSEF_OWNER_USER_ID&&
     this.env.KSEF_SYNC_ENABLED==="true"&&NIP.test(configuredNip||"")&&
     (!deherus||this.env.KSEF_DEHERUS_SYNC_ENABLED==="true");
   return {
     linked:Boolean(link),
     canLink:!link&&couldLink,
     canManage:Boolean(link&&link.ownerUserId===userId&&member.role==="OWNER"),
     canView:Boolean(link&&explicit),
     explanation:link?"Finanse widzą tylko osoby z osobnym dostępem finansowym.":
       deherus&&!couldLink?"KSeF Deherus nie jest jeszcze gotowy do połączenia. Wymagana jest osobna, aktywna synchronizacja.":
       "Połącz firmę z istniejącym KSeF właściciela. To nie udostępni danych innym pracownikom."
   };
 }
 async linkPilot(userId,organizationId){
   const member=await this.orgService.membership(userId,organizationId,["OWNER"]);
   const org=await this.db.organization.findUnique({
     where:{id:organizationId},select:{id:true,name:true,slug:true,displayName:true,status:true}
   });
   const deherus=isDeherus(org);
   if(!org || org.status!=="ACTIVE" || !(deherus||/dekonica/i.test(org.name+" "+org.slug)))
     throw new OrganizationError("Ta firma nie ma obsługiwanej konfiguracji KSeF.",400);
   const nip=String(deherus?this.env.KSEF_DEHERUS_NIP||"":this.env.KSEF_NIP||"").trim();
   if(deherus&&(nip!==DEHERUS_NIP||!this.env.KSEF_DEHERUS_TOKEN||this.env.KSEF_DEHERUS_SYNC_ENABLED!=="true"))
     throw new OrganizationError("Synchronizacja KSeF Deherus nie została jeszcze uruchomiona.",403);
   if(userId!==this.env.KSEF_OWNER_USER_ID||this.env.KSEF_SYNC_ENABLED!=="true"||!NIP.test(nip))
     throw new OrganizationError("Dostęp do KSeF tej firmy nie jest skonfigurowany na tym koncie.",403);
   const existing=await this.db.organizationFinanceLink.findUnique({
     where:{organizationId},select:{id:true,ownerUserId:true,nip:true}
   });
   if(existing){
     if(existing.ownerUserId!==userId||existing.nip!==nip)
       throw new OrganizationError("Ta firma ma inne powiązanie finansowe.",409);
     return {linked:true,alreadyLinked:true};
   }
   try{
     await this.db.organizationFinanceLink.create({
       data:{organizationId,ownerUserId:userId,nip},
       select:{id:true}
     });
   }catch(error){
     if(error.code==="P2002")
       throw new OrganizationError("Firma jest już połączona z KSeF.",409);
     throw error;
   }
   return {linked:true,alreadyLinked:false};
 }
 async members(userId,organizationId){
   const member=await this.orgService.membership(userId,organizationId,["OWNER"]);
   const link=await this.db.organizationFinanceLink.findUnique({
     where:{organizationId},select:{ownerUserId:true}
   });
   if(!link||link.ownerUserId!==userId)
     throw new OrganizationError("Nie masz uprawnień do dostępu finansowego.",403);
   const rows=await this.db.organizationMembership.findMany({
     where:{organizationId,status:"ACTIVE"},
     select:{id:true,userId:true,role:true,financeAccess:true,
       user:{select:{email:true}}},
     orderBy:{createdAt:"asc"}
   });
   return rows.map(row=>({
     id:row.id,userId:row.userId,role:row.role,
     isFinancialOwner:row.userId===link.ownerUserId,
     financeAccess:row.userId===link.ownerUserId||row.financeAccess,
     email:row.user.email
   }));
 }
 async setPermission(userId,organizationId,membershipId,enabled){
   if(typeof enabled!=="boolean")throw new OrganizationError("Podaj poprawną wartość uprawnienia.");
   await this.orgService.membership(userId,organizationId,["OWNER"]);
   const link=await this.db.organizationFinanceLink.findUnique({
     where:{organizationId},select:{ownerUserId:true}
   });
   if(!link||link.ownerUserId!==userId)
     throw new OrganizationError("Tylko właściciel integracji może nadawać dostęp do faktur.",403);
   const updated=await this.db.organizationMembership.updateMany({
     where:{id:membershipId,organizationId,status:"ACTIVE",
       userId:{not:link.ownerUserId},role:{not:"OWNER"}},
     data:{financeAccess:enabled}
   });
   if(updated.count!==1)throw new OrganizationError("Nie znaleziono uprawnionego pracownika.",404);
   return {id:membershipId,financeAccess:enabled};
 }
 async summary(userId,organizationId){
   const link=await this.accessible(userId,organizationId);
   const where=ksefDocPredicate(link.ownerUserId,link.nip);
   const [count,groups,ownerAgent]=await Promise.all([
     this.db.financialDocument.count({where}),
     this.db.financialDocument.groupBy({
       by:["currency","direction"],where,
       _sum:{grossAmount:true,netAmount:true,vatAmount:true},
       _count:{_all:true}
     }),
     this.db.agent.findFirst({
       where:{userId:link.ownerUserId,key:"financial",type:"FINANCIAL"},
       select:{enabled:true,status:true,lastRunAt:true}
     })
   ]);
   return {count,source:"KSEF",cashFlowAvailable:false,
     note:"Faktury są filtrowane po NIP firmy. Kwoty brutto nie oznaczają faktycznych wpływów na konto.",
     sync:{enabled:Boolean(ownerAgent?.enabled),status:ownerAgent?.status||"UNKNOWN",
       lastRunAt:ownerAgent?.lastRunAt||null},
     amounts:groups.map(r=>({
       currency:r.currency,direction:r.direction,count:r._count._all,
       gross:r._sum.grossAmount?.toString()||null,
       net:r._sum.netAmount?.toString()||null,
       vat:r._sum.vatAmount?.toString()||null
     }))
   };
 }
 async documents(userId,organizationId,options={}){
   const link=await this.accessible(userId,organizationId);
   const limit=normalizePageNumber(options.limit,50,100);
   const offset=normalizePageNumber(options.offset,0,50000);
   if(limit<1)throw new OrganizationError("Nieprawidłowy limit.");
   const where=ksefDocPredicate(link.ownerUserId,link.nip);
   const documents=await this.db.financialDocument.findMany({
     where,skip:offset,take:limit+1,
     orderBy:[{issueDate:"desc"},{createdAt:"desc"},{id:"desc"}],
     select:{id:true,invoiceNumber:true,ksefNumber:true,direction:true,
       sellerName:true,sellerNip:true,buyerName:true,buyerNip:true,issueDate:true,
       dueDate:true,currency:true,netAmount:true,grossAmount:true,vatAmount:true,
       project:{select:{id:true,name:true}}}
   });
   return {
     items:documents.slice(0,limit).map(r=>({
       ...r,
       netAmount:r.netAmount?.toString()||null,
       grossAmount:r.grossAmount?.toString()||null,
       vatAmount:r.vatAmount?.toString()||null
     })),
     hasMore:documents.length>limit,
     limit,offset
   };
 }
 async projects(userId,organizationId){
   const link=await this.accessible(userId,organizationId);
   const org=await this.db.organization.findUnique({where:{id:organizationId},select:{name:true,slug:true,displayName:true}});
   const companyFilter=isDeherus(org)?{OR:[{company:{contains:"Deherus",mode:"insensitive"}},{company:{equals:"M1",mode:"insensitive"}}]}:{company:{contains:"Dekonica",mode:"insensitive"}};
   const rows=await this.db.project.findMany({
     where:{userId:link.ownerUserId,status:"ACTIVE",...companyFilter},
     select:{id:true,name:true,company:true,aliases:true},
     orderBy:{name:"asc"},take:200
   });
   return {items:rows};
 }
}
module.exports={OrganizationFinanceService,ksefDocPredicate};
