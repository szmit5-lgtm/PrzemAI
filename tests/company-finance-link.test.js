"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const Module=require("node:module");
const file=require("node:path").resolve(__dirname,"../api/services/OrganizationFinanceService.js");

function makeService({env,permission=false,linkPresent=true,ownerActive=true}={}){
  const state={links:linkPresent?[{id:"link",organizationId:"dek",ownerUserId:"owner",nip:"1234567890"}]:[],
    memberships:[
      {id:"owner-membership",userId:"owner",organizationId:"dek",role:"OWNER",status:"ACTIVE",financeAccess:false},
      {id:"member-membership",userId:"member",organizationId:"dek",role:"MEMBER",status:"ACTIVE",financeAccess:permission},
      {id:"outsider-membership",userId:"outsider",organizationId:"other",role:"OWNER",status:"ACTIVE",financeAccess:true}
    ],documents:[
      {id:"a",userId:"owner",source:"KSEF",buyerNip:"1234567890",sellerNip:"6666666666",direction:"INCOMING",grossAmount:"100.00",currency:"PLN"},
      {id:"b",userId:"owner",source:"KSEF",buyerNip:"6666666666",sellerNip:"1234567890",direction:"OUTGOING",grossAmount:"200.00",currency:"PLN"},
      {id:"c",userId:"owner",source:"KSEF",buyerNip:"9999999999",sellerNip:"9999999999",direction:"INCOMING",grossAmount:"3000.00",currency:"PLN"},
      {id:"d",userId:"outsider",source:"KSEF",buyerNip:"1234567890",sellerNip:"9999999999",direction:"INCOMING",grossAmount:"9999.00",currency:"PLN"},
      {id:"e",userId:"owner",source:"MAIL",buyerNip:"1234567890",sellerNip:"9999999999",direction:"INCOMING",grossAmount:"999.00",currency:"PLN"}
    ]};
  const db={
    organizationMembership:{
      async findFirst({where}){
        return state.memberships.find(m=>m.userId===where.userId&&m.organizationId===where.organizationId&&
          m.status===where.status&&(where.financeAccess===undefined||m.financeAccess===where.financeAccess)&&
          (!where.role||where.role.in.includes(m.role)))||null;
      },
      async updateMany({where,data}){
        const arr=state.memberships.filter(m=>m.id===where.id&&m.organizationId===where.organizationId&&
          m.status===where.status&&m.role!==where.role.not&&m.userId!==where.userId.not);
        arr.forEach(x=>Object.assign(x,data));return{count:arr.length};
      },
      async findMany({where}){
        return state.memberships.filter(m=>m.organizationId===where.organizationId&&m.status===where.status)
          .map(m=>({...m,user:{email:m.userId+"@example.test"}}));
      }
    },
    organization:{async findUnique({where}){return where.id==="dek"?{id:"dek",name:"Dekonica",slug:"dekonica",status:"ACTIVE"}:null;}},
    organizationFinanceLink:{
      async findUnique({where}){return state.links.find(x=>x.organizationId===where.organizationId)||null;},
      async create({data}){const v={id:"new-link",...data};state.links.push(v);return v;}
    },
    agent:{async findFirst(){return {enabled:true,status:"IDLE",lastRunAt:null};}},
    financialDocument:{
      async count({where}){return filter(where).length;},
      async findMany({where}){return filter(where).map(x=>({...x,project:null}));},
      async groupBy({where}){const rows=filter(where);return [
        {currency:"PLN",direction:"INCOMING",_count:{_all:rows.filter(x=>x.direction==="INCOMING").length},
          _sum:{grossAmount:{toString(){return "100.00";}},netAmount:null,vatAmount:null}},
        {currency:"PLN",direction:"OUTGOING",_count:{_all:rows.filter(x=>x.direction==="OUTGOING").length},
          _sum:{grossAmount:{toString(){return "200.00";}},netAmount:null,vatAmount:null}}
      ];},
    },
    project:{async findMany(){return [{id:"project",name:"Mielno",company:"Dekonica"}];}}
  };
  function filter(where){
    return state.documents.filter(x=>x.userId===where.userId&&x.source===where.source&&
      where.OR.some(q=>(q.buyerNip&&q.buyerNip===x.buyerNip)||(q.sellerNip&&q.sellerNip===x.sellerNip)));
  }
  const orgSvc={
    async membership(userId,orgId,roles=["OWNER","ADMIN","MEMBER"]){
      const m=state.memberships.find(x=>x.userId===userId&&x.organizationId===orgId&&
        x.status==="ACTIVE"&&roles.includes(x.role));
      if(!m)throw Error("Brak uprawnień do firmy.");
      return m;
    }
  };
  const original=Module._load;
  Module._load=function(req,parent,isMain){
    if(parent?.filename===file && req==="../../lib/prisma")return db;
    if(parent?.filename===file && req==="./OrganizationService")return {OrganizationService:class {},OrganizationError:class extends Error {constructor(message,status=400){super(message);this.status=status;}}};
    return original.call(this,req,parent,isMain);
  };
  let Service,ksefDocPredicate;
  try{delete require.cache[file];({OrganizationFinanceService:Service,ksefDocPredicate}=require(file));}
  finally{Module._load=original;}
  return {svc:new Service({db,orgService:orgSvc,
    env:env||{KSEF_OWNER_USER_ID:"owner",KSEF_SYNC_ENABLED:"true",KSEF_NIP:"1234567890"}}),
    state,db,ksefDocPredicate};
}
test("company finance must be linked by its original configured owner",async()=>{
 const {svc,state}=makeService({linkPresent:false});
 await assert.rejects(svc.linkPilot("member","dek"),/Brak uprawnień/);
 await assert.rejects(svc.linkPilot("outsider","dek"),/Brak uprawnień/);
 const success=await svc.linkPilot("owner","dek");
 assert.deepEqual(success,{linked:true,alreadyLinked:false});
 assert.equal(state.links.length,1);
 assert.equal(state.links[0].nip,"1234567890");
 assert.equal(state.links[0].ownerUserId,"owner");
 await svc.linkPilot("owner","dek");
 assert.equal(state.links.length,1);
});
test("an ordinary employee has zero finance access by default",async()=>{
 const {svc}=makeService();
 const status=await svc.linkStatus("member","dek");
 assert.equal(status.linked,true);
 assert.equal(status.canView,false);
 await assert.rejects(svc.summary("member","dek"),/Nie masz dostępu/);
 await assert.rejects(svc.documents("member","dek"),/Nie masz dostępu/);
 await assert.rejects(svc.projects("member","dek"),/Nie masz dostępu/);
});
test("owner can grant read-only finance access and revoke it",async()=>{
 const {svc}=makeService();
 const grant=await svc.setPermission("owner","dek","member-membership",true);
 assert.equal(grant.financeAccess,true);
 assert.equal((await svc.linkStatus("member","dek")).canView,true);
 assert.equal((await svc.summary("member","dek")).count,2);
 await svc.setPermission("owner","dek","member-membership",false);
 await assert.rejects(svc.summary("member","dek"),/Nie masz dostępu/);
});
test("cross-company actor cannot read finance even when their org membership grants finance elsewhere",async()=>{
 const {svc}=makeService({permission:true});
 await assert.rejects(svc.summary("outsider","dek"),/Brak uprawnień/);
 await assert.rejects(svc.setPermission("outsider","dek","member-membership",true),/Brak uprawnień/);
 await assert.rejects(svc.summary("owner","other"),/Brak uprawnień/);
});
test("KSeF documents are owner-scoped, exact-NIP filtered, without XML or metadata",async()=>{
 const {svc,ksefDocPredicate}=makeService({permission:true});
 const where=ksefDocPredicate("owner","1234567890");
 assert.deepEqual(where,{userId:"owner",source:"KSEF",OR:[
  {buyerNip:"1234567890"},{sellerNip:"1234567890"}]});
 const data=await svc.documents("member","dek",{limit:50,offset:0});
 assert.deepEqual(data.items.map(x=>x.id),["a","b"]);
 assert.equal(data.items[0].rawData,undefined);
 assert.equal(data.items[0].metadata,undefined);
 const summary=await svc.summary("member","dek");
 assert.equal(summary.count,2);
 assert.equal(summary.cashFlowAvailable,false);
});
test("grant cannot elevate self, owner, cross-organization or unknown membership",async()=>{
 const {svc}=makeService();
 for(const id of ["owner-membership","outsider-membership","nonexistent"]){
  await assert.rejects(svc.setPermission("owner","dek",id,true),/Nie znaleziono/);
 }
 await assert.rejects(svc.setPermission("member","dek","member-membership",true),/Brak uprawnień/);
});
test("wrong configured KSeF owner or missing NIP prevents pilot linkage",async()=>{
 const {svc}=makeService({linkPresent:false,env:{KSEF_OWNER_USER_ID:"someone-else",
  KSEF_SYNC_ENABLED:"true",KSEF_NIP:"1234567890"}});
 await assert.rejects(svc.linkPilot("owner","dek"),/nie jest skonfigurowany/);
 const e=makeService({linkPresent:false,env:{KSEF_OWNER_USER_ID:"owner",
  KSEF_SYNC_ENABLED:"true",KSEF_NIP:""}}).svc;
 await assert.rejects(e.linkPilot("owner","dek"),/nie jest skonfigurowany/);
});
test("API exposes finance only through authentication and organization routes",async()=>{
 const fs=require("node:fs");
 const path=require("node:path");
 const routes=fs.readFileSync(path.resolve(__dirname,"../api/routes/organizationRoutes.js"),"utf8");
 assert.match(routes,/router\.get\("\/:id\/finance\/summary",verifyToken/);
 assert.match(routes,/router\.get\("\/:id\/finance\/documents",verifyToken/);
 assert.match(routes,/router\.patch\("\/:id\/finance\/members\/:membershipId",verifyToken/);
});
