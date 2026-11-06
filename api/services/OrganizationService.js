"use strict";

const crypto=require("node:crypto");
const dns=require("node:dns/promises");
const prisma=require("../../lib/prisma");

class OrganizationError extends Error {
  constructor(message,status=400){super(message);this.status=status;}
}
const validSlug=x=>typeof x==="string"&&/^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$/.test(x);
const normalizeEmail=x=>typeof x==="string"?x.trim().toLowerCase():"";
function validateCompany({name,slug}){
  const n=typeof name==="string"?name.trim():"";
  const s=typeof slug==="string"?slug.trim().toLowerCase():"";
  if(n.length<2||n.length>120||!validSlug(s))
    throw new OrganizationError("Podaj nazwę i identyfikator firmy (3–40 małych liter, cyfr i łączników).");
  return{name:n,slug:s};
}
function validateDomain(value) {
  const name=typeof value==="string"?value.trim().toLowerCase().replace(/\.$/,""):"";
  if(name.length>253||name.length<5||!(/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?){1,}$/.test(name)))
    throw new OrganizationError("Podaj pełną domenę, np. api.twojafirma.pl.");
  const suffixes=[".localhost",".internal",".local",".test",".invalid",".example",".vercel.app",".up.railway.app"];
  if(["przemai.pl","localhost"].includes(name)||name.endsWith(".przemai.pl")||
    suffixes.some(s=>name.endsWith(s))||/^\d+\.\d+\.\d+\.\d+$/.test(name))
    throw new OrganizationError("Ta domena nie może zostać podłączona.");
  return name;
}
function verificationProof(orgId,hostname,secret=process.env.JWT_SECRET){
  if(typeof secret!=="string"||secret.length<16)
    throw new OrganizationError("Weryfikacja domen nie jest skonfigurowana.",503);
  const challenge=crypto.createHmac("sha256",secret)
    .update("PrzemAI-company-domain-v1:"+orgId+":"+hostname).digest("hex").slice(0,40);
  return {record:"_przemai-verification."+hostname,
    value:"przemai-verification="+challenge};
}
class OrganizationService{
  constructor({db=prisma,dnsLookup=hostname=>dns.resolveTxt(hostname),secret=process.env.JWT_SECRET}={}){
    this.db=db;this.dnsLookup=dnsLookup;this.secret=secret;
  }
  async membership(userId,orgId,roles=["OWNER","ADMIN","MEMBER"]){
    if(typeof userId!=="string"||!userId||typeof orgId!=="string"||!orgId)
      throw new OrganizationError("Brak uprawnień do firmy.",403);
    const member=await this.db.organizationMembership.findFirst({
      where:{userId,organizationId:orgId,status:"ACTIVE",
        organization:{status:"ACTIVE"},role:{in:roles}},
      select:{id:true,role:true,organizationId:true,userId:true}
    });
    if(!member||member.userId!==userId||member.organizationId!==orgId||
      !roles.includes(member.role))throw new OrganizationError("Brak uprawnień do firmy.",403);
    return member;
  }
  async companies(userId){
    const members=await this.db.organizationMembership.findMany({
      where:{userId,status:"ACTIVE",organization:{status:"ACTIVE"}},
      include:{organization:{include:{domains:{select:{
        id:true,hostname:true,verifiedAt:true,isPrimary:true
      }}}}},
      orderBy:{createdAt:"asc"}
    });
    return members.map(({role,organization})=>({...organization,role}));
  }
  async details(userId,orgId) {
    const member=await this.membership(userId,orgId);
    const org=await this.db.organization.findUnique({
      where:{id:orgId},
      select:{id:true,name:true,slug:true,displayName:true,logoUrl:true,accentColor:true,status:true,
        domains:{select:{id:true,hostname:true,verifiedAt:true,isPrimary:true},
          orderBy:{createdAt:"desc"}}
      }
    });
    if(!org)throw new OrganizationError("Nie znaleziono firmy.",404);
    return {...org,role:member.role};
  }
  async changeBranding(userId,orgId,input){
    await this.membership(userId,orgId,["OWNER","ADMIN"]);
    const changes={};
    if(Object.prototype.hasOwnProperty.call(input||{},"displayName")){
      const name=String(input.displayName||"").trim();
      if(name.length<2||name.length>120)throw new OrganizationError("Nazwa wyświetlana musi mieć 2–120 znaków.");
      changes.displayName=name;
    }
    if(Object.prototype.hasOwnProperty.call(input||{},"accentColor")){
      const color=String(input.accentColor||"").trim();
      if(color&&!/^#[0-9a-fA-F]{6}$/.test(color))
        throw new OrganizationError("Kolor marki powinien mieć postać #RRGGBB.");
      changes.accentColor=color||null;
    }
    if(Object.prototype.hasOwnProperty.call(input||{},"logoUrl")){
      const logo=String(input.logoUrl||"").trim();
      // Small raster logos can be uploaded directly from the browser.
      // Store a validated data URL instead of relying on short-lived local files
      // or private document-sharing links. Limit size to 512 KiB.
      if (logo.startsWith("data:")) {
        const match=/^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+\/]+={0,2})$/.exec(logo);
        if (!match || logo.length>730000 || match[2].length%4!==0)
          throw new OrganizationError("Logo musi być plikiem PNG, JPG lub WEBP do 512 KB.");
        const bytes=Buffer.from(match[2],"base64");
        if (!bytes.length || bytes.length>512*1024 || bytes.toString("base64")!==match[2])
          throw new OrganizationError("Nieprawidłowe dane obrazu logo.");
        const type=match[1];
        const png=bytes.length>=8&&bytes.subarray(0,8).equals(Buffer.from("89504e470d0a1a0a","hex"));
        const jpeg=bytes.length>=4&&bytes[0]===255&&bytes[1]===216&&bytes[bytes.length-2]===255&&bytes[bytes.length-1]===217;
        const webp=bytes.length>=12&&bytes.toString("ascii",0,4)==="RIFF"&&bytes.toString("ascii",8,12)==="WEBP";
        if (!(type==="png"&&png || type==="jpeg"&&jpeg || type==="webp"&&webp))
          throw new OrganizationError("Zawartość pliku nie odpowiada formatowi obrazu.");
      } else if(logo&&(logo.length>500||!/^https:\/\/[a-z0-9][a-z0-9.-]+(?:\/|$)/i.test(logo) ||
        /[<>"'\s]/.test(logo))) {
        throw new OrganizationError("Podaj adres HTTPS obrazu albo prześlij plik PNG, JPG lub WEBP.");
      }
      changes.logoUrl=logo||null;
    }
    if(!Object.keys(changes).length)throw new OrganizationError("Nie podano zmian.");
    return this.db.organization.update({
      where:{id:orgId},data:changes,
      select:{id:true,name:true,displayName:true,accentColor:true,logoUrl:true}
    });
  }
  async requestDomain(userId,orgId,input){
    await this.membership(userId,orgId,["OWNER"]);
    const hostname=validateDomain(input?.hostname);
    const record=await this.db.organizationDomain.create({
      data:{organizationId:orgId,hostname,verifiedAt:null,isPrimary:false},
      select:{id:true,hostname:true,verifiedAt:true,isPrimary:true}
    });
    return {...record,dns:verificationProof(orgId,hostname,this.secret),status:"PENDING_DNS"};
  }
  async verifyDomain(userId,orgId,domainId){
    await this.membership(userId,orgId,["OWNER"]);
    const domain=await this.db.organizationDomain.findFirst({
      where:{id:domainId,organizationId:orgId},
      select:{id:true,hostname:true,verifiedAt:true}
    });
    if(!domain)throw new OrganizationError("Nie znaleziono domeny firmy.",404);
    if(domain.verifiedAt)return {...domain,status:"VERIFIED"};
    const proof=verificationProof(orgId,domain.hostname,this.secret);
    let entries;
    try{entries=await this.dnsLookup(proof.record);}
    catch{throw new OrganizationError("Nie odnaleziono jeszcze rekordu DNS TXT. Spróbuj po propagacji DNS.",409);}
    const found=Array.isArray(entries)&&entries.some(entry=>
      Array.isArray(entry)&&entry.join("")===proof.value);
    if(!found)throw new OrganizationError("Rekord TXT jest nieprawidłowy lub jeszcze nieaktywny.",409);
    await this.db.organizationDomain.updateMany({
      where:{id:domain.id,organizationId:orgId,verifiedAt:null},
      data:{verifiedAt:new Date()}
    });
    return {id:domain.id,hostname:domain.hostname,status:"VERIFIED",
      deploymentStatus:"AWAITING_HOSTING_AND_SSL"};
  }
  async domainInstructions(userId,orgId,domainId){
    await this.membership(userId,orgId,["OWNER"]);
    const domain=await this.db.organizationDomain.findFirst({
      where:{id:domainId,organizationId:orgId},
      select:{id:true,hostname:true,verifiedAt:true,isPrimary:true}
    });
    if(!domain)throw new OrganizationError("Nie znaleziono domeny.",404);
    return {...domain,dns:verificationProof(orgId,domain.hostname,this.secret),
      deploymentStatus:"AWAITING_HOSTING_AND_SSL"};
  }
  async members(userId,orgId){
    await this.membership(userId,orgId,["OWNER","ADMIN"]);
    return this.db.organizationMembership.findMany({
      where:{organizationId:orgId},
      select:{id:true,role:true,status:true,createdAt:true,
        user:{select:{id:true,email:true}}},
      orderBy:{createdAt:"asc"}
    });
  }
  async invite(userId,orgId,payload){
    const sender=await this.membership(userId,orgId,["OWNER","ADMIN"]);
    const email=normalizeEmail(payload?.email);
    const role=payload?.role||"MEMBER";
    if(email.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      throw new OrganizationError("Podaj poprawny e-mail użytkownika.");
    if(!["MEMBER","ADMIN"].includes(role)||(role==="ADMIN"&&sender.role!=="OWNER"))
      throw new OrganizationError("Nie możesz nadać tej roli.",403);
    const user=await this.db.user.findUnique({where:{email},select:{id:true,email:true}});
    if(!user)throw new OrganizationError("Ta osoba musi najpierw założyć własne konto PrzemAI.",404);
    if(user.id===userId)throw new OrganizationError("Nie można zaprosić samego siebie.");
    const old=await this.db.organizationMembership.findUnique({
      where:{organizationId_userId:{organizationId:orgId,userId:user.id}}
    });
    if(old?.status==="ACTIVE")throw new OrganizationError("Użytkownik należy już do firmy.",409);
    // The invitee must explicitly accept; never activate membership on invite.
    return this.db.organizationMembership.upsert({
      where:{organizationId_userId:{organizationId:orgId,userId:user.id}},
      create:{organizationId:orgId,userId:user.id,role,status:"PENDING"},
      update:{status:"PENDING",role},
      select:{id:true,status:true,role:true,user:{select:{email:true}}}
    });
  }
  async pendingInvites(userId){
    return this.db.organizationMembership.findMany({
      where:{userId,status:"PENDING",organization:{status:"ACTIVE"}},
      select:{id:true,role:true,organizationId:true,
        organization:{select:{name:true,displayName:true,slug:true}}}
    });
  }
  async acceptInvite(userId,orgId){
    const updated=await this.db.organizationMembership.updateMany({
      where:{organizationId:orgId,userId,status:"PENDING",organization:{status:"ACTIVE"}},
      data:{status:"ACTIVE"}
    });
    if(updated.count!==1)throw new OrganizationError("Zaproszenie jest nieaktualne.",404);
    return {organizationId:orgId,status:"ACTIVE"};
  }
  async revoke(userId,orgId,membershipId){
    await this.membership(userId,orgId,["OWNER"]);
    const updated=await this.db.organizationMembership.updateMany({
      where:{id:membershipId,organizationId:orgId,role:{not:"OWNER"},
        userId:{not:userId},status:{in:["ACTIVE","PENDING"]}},
      data:{status:"REVOKED"}
    });
    if(updated.count!==1)throw new OrganizationError("Nie można odebrać tego dostępu.",404);
    return {id:membershipId,status:"REVOKED"};
  }
  async workspace(userId,orgId){
    const company=await this.details(userId,orgId);
    const tasks=await this.db.task.findMany({
      where:{source:"COMPANY",metadata:{path:["organizationId"],equals:orgId}},
      orderBy:[{status:"asc"},{createdAt:"desc"}],take:150,
      select:{id:true,title:true,description:true,status:true,priority:true,dueDate:true,
        createdAt:true,completedAt:true,metadata:true}
    });
    return {company,tasks,scope:"ORGANIZATION_ONLY",
      legacyDataNotice:"Faktury KSeF, historia, czat i agenci ze starego konta pozostają osobiste, dopóki ich dane nie zostaną bezpiecznie przeniesione do organizacji."};
  }
  async createCompanyTask(userId,orgId,payload){
    await this.membership(userId,orgId);
    const title=typeof payload?.title==="string"?payload.title.trim():"";
    const description=typeof payload?.description==="string"?payload.description.trim():"";
    const priority=["LOW","MEDIUM","HIGH","URGENT"].includes(payload?.priority)?payload.priority:"MEDIUM";
    if(title.length<3||title.length>180||description.length>5000)
      throw new OrganizationError("Tytuł zadania musi mieć 3–180 znaków; opis maksymalnie 5000.");
    let dueDate=null;
    if(payload?.dueDate){
      const input=String(payload.dueDate);
      if(!/^\d{4}-\d{2}-\d{2}$/.test(input)||
        Number.isNaN(new Date(input+"T12:00:00Z").getTime()))
        throw new OrganizationError("Data zadania musi być w formacie RRRR-MM-DD.");
      dueDate=new Date(input+"T12:00:00Z");
    }
    return this.db.task.create({
      data:{userId,title,description,source:"COMPANY",priority,status:"TODO",dueDate,
        tags:["COMPANY"],metadata:{organizationId:orgId,createdBy:userId}},
      select:{id:true,title:true,description:true,status:true,priority:true,dueDate:true,createdAt:true}
    });
  }
  async setCompanyTaskStatus(userId,orgId,taskId,status){
    await this.membership(userId,orgId);
    if(!["TODO","IN_PROGRESS","DONE"].includes(status))
      throw new OrganizationError("Nieprawidłowy status zadania.");
    const updated=await this.db.task.updateMany({
      where:{id:taskId,source:"COMPANY",
        metadata:{path:["organizationId"],equals:orgId}},
      data:{status,completedAt:status==="DONE"?new Date():null}
    });
    if(updated.count!==1)throw new OrganizationError("Nie znaleziono zadania w tej firmie.",404);
    return {id:taskId,status};
  }
}
module.exports={OrganizationService,OrganizationError,validateCompany,validateDomain,verificationProof};
