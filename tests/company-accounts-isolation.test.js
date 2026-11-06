"use strict";

const test=require("node:test");
const assert=require("node:assert/strict");
const {OrganizationService,validateDomain,verificationProof}
  =require("../api/services/OrganizationService");

function environment(){
 const users=[
  {id:"owner",email:"owner@example.org"},
  {id:"member",email:"member@example.org"},
  {id:"otherOwner",email:"other@example.org"},
  {id:"visitor",email:"visitor@example.org"}
 ];
 const orgs=[
  {id:"a",slug:"alpha",name:"Alpha",displayName:"Alpha",status:"ACTIVE",domains:[]},
  {id:"b",slug:"beta",name:"Beta",displayName:"Beta",status:"ACTIVE",domains:[]}
 ];
 const memberships=[
  {id:"m1",organizationId:"a",userId:"owner",status:"ACTIVE",role:"OWNER"},
  {id:"m2",organizationId:"a",userId:"member",status:"ACTIVE",role:"MEMBER"},
  {id:"m3",organizationId:"b",userId:"otherOwner",status:"ACTIVE",role:"OWNER"}
 ];
 const tasks=[
  {id:"ta",userId:"owner",source:"COMPANY",status:"TODO",title:"Alpha job",
    metadata:{organizationId:"a"}},
  {id:"tb",userId:"otherOwner",source:"COMPANY",status:"TODO",title:"Beta job",
    metadata:{organizationId:"b"}}
 ];
 const domains=[];
 const db={
  organizationMembership:{
   async findFirst({where}) {
    return memberships.find(m=>m.userId===where.userId&&m.organizationId===where.organizationId&&
      m.status===where.status&&where.role.in.includes(m.role)&&
      orgs.find(o=>o.id===m.organizationId)?.status==="ACTIVE")||null;
   },
   async findUnique({where}) {
    return memberships.find(m=>m.organizationId===where.organizationId_userId.organizationId&&
      m.userId===where.organizationId_userId.userId)||null;
   },
   async findMany({where}) {
    return memberships.filter(m=>
      (!where.userId||m.userId===where.userId)&&
      (!where.status||m.status===where.status)&&
      (!where.organizationId||m.organizationId===where.organizationId)
    ).map(m=>({...m,user:users.find(u=>u.id===m.userId),
      organization:orgs.find(o=>o.id===m.organizationId)}));
   },
   async updateMany({where,data}) {
    const match=memberships.filter(m=>m.organizationId===where.organizationId&&
      (!where.userId||(typeof where.userId==="string"?m.userId===where.userId:m.userId!==where.userId.not))&&
      (!where.status||(typeof where.status==="string"?m.status===where.status:where.status.in.includes(m.status)))&&
      (!where.id||m.id===where.id)&&(!where.role||m.role!==where.role.not));
    for(const m of match)Object.assign(m,data);
    return{count:match.length};
   },
   async upsert({where,create,update}){
    const m=memberships.find(v=>v.organizationId===where.organizationId_userId.organizationId&&
      v.userId===where.organizationId_userId.userId);
    if(m){Object.assign(m,update);return {...m,user:users.find(u=>u.id===m.userId)};}
    const value={id:"m"+(memberships.length+1),...create};
    memberships.push(value);
    return{...value,user:users.find(u=>u.id===value.userId)};
   }
  },
  organization:{
   async findUnique({where}){return orgs.find(o=>o.id===where.id)||null;},
   async update({where,data}){const org=orgs.find(o=>o.id===where.id);Object.assign(org,data);return org;}
  },
  organizationDomain:{
   async create({data}){const value={id:"d"+(domains.length+1),...data};domains.push(value);
    orgs.find(o=>o.id===data.organizationId).domains.push(value);return value;},
   async findFirst({where}){return domains.find(d=>d.id===where.id&&d.organizationId===where.organizationId)||null;},
   async updateMany({where,data}){let count=0;for(const d of domains){if(d.id===where.id&&
      d.organizationId===where.organizationId&&!d.verifiedAt){Object.assign(d,data);count++;}}
    return{count};}
  },
  user:{async findUnique({where}){return users.find(u=>u.email===where.email)||null;}},
  task:{
   async findMany({where}){
    assert.equal(where.source,"COMPANY");
    return tasks.filter(t=>t.source==="COMPANY"&&t.metadata.organizationId===where.metadata.equals);
   },
   async create({data}){const task={id:"t"+(tasks.length+1),...data};tasks.push(task);return task;},
   async updateMany({where,data}){const task=tasks.find(t=>t.id===where.id&&t.source===where.source&&
      t.metadata.organizationId===where.metadata.equals);
    if(!task)return{count:0};Object.assign(task,data);return{count:1};}
  }
 };
 return{db,orgs,memberships,tasks,domains,users};
}
function service({db},extra={}) {
 return new OrganizationService({db,secret:"test-secret-long-enough-for-hmac",...extra});
}
test("company tasks are separated by organization and checked on every read",async()=>{
 const env=environment(),svc=service(env);
 assert.deepEqual((await svc.workspace("owner","a")).tasks.map(t=>t.id),["ta"]);
 assert.deepEqual((await svc.workspace("otherOwner","b")).tasks.map(t=>t.id),["tb"]);
 await assert.rejects(svc.workspace("owner","b"),/Brak uprawnień/);
 await assert.rejects(svc.workspace("visitor","a"),/Brak uprawnień/);
 const task=await svc.createCompanyTask("member","a",{title:"Zadanie zespołu",description:"Do realizacji"});
 assert.equal(task.metadata.organizationId,"a");
 assert.equal(task.userId,"member");
 assert.equal((await svc.workspace("owner","a")).tasks.length,2);
 assert.equal((await svc.workspace("otherOwner","b")).tasks.length,1);
 await assert.rejects(svc.setCompanyTaskStatus("otherOwner","b",task.id,"DONE"),/Nie znaleziono/);
 await svc.setCompanyTaskStatus("owner","a",task.id,"DONE");
 assert.equal(task.status,"DONE");
});
test("revoked member loses access even to a company task they originally created",async()=>{
 const env=environment(),svc=service(env);
 const task=await svc.createCompanyTask("member","a",{title:"Zadanie testowe"});
 await svc.revoke("owner","a","m2");
 await assert.rejects(svc.workspace("member","a"),/Brak uprawnień/);
 await assert.rejects(svc.setCompanyTaskStatus("member","a",task.id,"DONE"),/Brak uprawnień/);
 await assert.rejects(svc.createCompanyTask("member","a",{title:"Dodatkowe zadanie"}),/Brak uprawnień/);
});
test("non-owner cannot assign admin role, configure domain or remove another member",async()=>{
 const env=environment(),svc=service(env);
 await assert.rejects(svc.invite("member","a",{email:"visitor@example.org",role:"ADMIN"}),/Brak uprawnień/);
 await assert.rejects(svc.requestDomain("member","a",{hostname:"api.alpha.com"}),/Brak uprawnień/);
 await assert.rejects(svc.revoke("member","a","m1"),/Brak uprawnień/);
 await assert.rejects(svc.changeBranding("member","a",{displayName:"Nowa marka"}),/Brak uprawnień/);
 await assert.rejects(svc.revoke("owner","a","m1"),/Nie można odebrać/);
});
test("invitation remains pending until invited person explicitly accepts",async()=>{
 const env=environment(),svc=service(env);
 const invitation=await svc.invite("owner","a",{email:"visitor@example.org",role:"MEMBER"});
 assert.equal(invitation.status,"PENDING");
 await assert.rejects(svc.workspace("visitor","a"),/Brak uprawnień/);
 const pending=await svc.pendingInvites("visitor");
 assert.equal(pending.length,1);
 const accepted=await svc.acceptInvite("visitor","a");
 assert.equal(accepted.status,"ACTIVE");
 assert.equal((await svc.workspace("visitor","a")).company.role,"MEMBER");
 await assert.rejects(svc.invite("owner","a",{email:"visitor@example.org"}),/już/);
});
test("DNS ownership uses exact HMAC token; verification does not activate hosting",async()=>{
 const env=environment();
 const proof=verificationProof("a","api.alpha.com","test-secret-long-enough-for-hmac");
 const svc=service(env,{dnsLookup:async hostname=>{
  assert.equal(hostname,proof.record);return [[proof.value]];
 }});
 const domain=await svc.requestDomain("owner","a",{hostname:"api.alpha.com"});
 assert.equal(domain.verifiedAt,null);
 assert.equal(domain.isPrimary,false);
 assert.deepEqual(domain.dns,proof);
 await assert.rejects(svc.verifyDomain("otherOwner","b",domain.id),/Nie znaleziono/);
 const result=await svc.verifyDomain("owner","a",domain.id);
 assert.equal(result.status,"VERIFIED");
 assert.equal(result.deploymentStatus,"AWAITING_HOSTING_AND_SSL");
 assert.equal(env.domains[0].isPrimary,false);
 assert.ok(env.domains[0].verifiedAt instanceof Date);
});
test("unknown or reserved domain is refused and no DNS or DB creation occurs",async()=>{
 const env=environment(),svc=service(env);
 for(const hostname of ["przemai.pl","admin.przemai.pl","localhost","127.0.0.1",
   "test.local","abc.vercel.app","https://example.org","api.invalid","bad domain.com"]){
  assert.throws(()=>validateDomain(hostname));
  await assert.rejects(svc.requestDomain("owner","a",{hostname}),/domena|domeny/i);
 }
 assert.equal(env.domains.length,0);
});
test("invalid branding cannot overwrite another user's company or execute script scheme",async()=>{
 const env=environment(),svc=service(env);
 await assert.rejects(svc.changeBranding("owner","b",{displayName:"Błąd"}),/Brak uprawnień/);
 await assert.rejects(svc.changeBranding("owner","a",{logoUrl:"javascript:alert(1)"}),/HTTPS/);
 await assert.rejects(svc.changeBranding("owner","a",{accentColor:"red;expression(1)"}),/kolor/i);
 const saved=await svc.changeBranding("owner","a",{
  displayName:"Alpha Group",logoUrl:"https://example.org/logo.png",accentColor:"#8b5cf6"
 });
 assert.equal(saved.displayName,"Alpha Group");
 assert.equal(saved.logoUrl,"https://example.org/logo.png");
});
test("company task status denies any non-company task even when ID is supplied",async()=>{
 const env=environment(),svc=service(env);
 env.tasks.push({id:"personal",userId:"owner",source:"MANUAL",status:"TODO",
   metadata:{organizationId:"a"}});
 await assert.rejects(svc.setCompanyTaskStatus("owner","a","personal","DONE"),/Nie znaleziono/);
 assert.equal(env.tasks.at(-1).status,"TODO");
});
