"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {OperationalStatusService,progress,validOwner}=require("../api/services/OperationalStatusService");
const NOW=new Date("2026-11-21T12:00:00.000Z");
const mailEnv={DEKONICA_MAIL_OWNER_USER_ID:"owner"};
const ksefEnv={KSEF_OWNER_USER_ID:"owner",KSEF_SYNC_ENABLED:"true",
 KSEF_NIP:"1234567890",KSEF_TOKEN:"TEST-ONLY-TOKEN",
 KSEF_ENVIRONMENT:"production",KSEF_DEHERUS_SYNC_ENABLED:"false",
 KSEF_DEHERUS_NIP:"1133200454"};
function harness({mail=null,agent=null,env=mailEnv}={}){
 const calls={provision:[],integration:[],agent:[],history:[]};
 const item=mail||{id:"mail-id",type:"MAIL",provider:"HOME_PL",
  enabled:false,lastSyncAt:null,
  config:{email:"office@dekonica.com",passwordEnv:"DEKONICA_MAIL_PASSWORD"}};
 const agentRow=agent||{enabled:true,status:"IDLE",nextRunAt:NOW,lastRunAt:null,config:{
  ksefBackfillCursor:"2026-10-01T00:00:00.000Z",
  ksefDeherusBackfillCursor:"2026-08-01T00:00:00.000Z"}};
 const db={
  integration:{async findFirst(args){calls.integration.push(args);return item;}},
  agent:{async findUnique(args){calls.agent.push(args);return agentRow;}},
  history:{async count(args){calls.history.push(args);return 3;}}
 };
 const provision={async ensureDefaults(id){calls.provision.push(id);}};
 const service=new OperationalStatusService({db,provision,env,now:()=>NOW});
 return {service,calls,item,agentRow};
}
test("mail status shows explicit owner control without exposing credentials",async()=>{
 const {service,calls}=harness();
 const result=await service.mail("owner");
 assert.equal(result.mailbox,"office@dekonica.com");
 assert.equal(result.state,"DISABLED");
 assert.equal(result.enabled,false);
 assert.equal(result.canEnable,true);
 assert.equal(result.integrationId,"mail-id");
 assert.equal(result.agentEnabled,true);
 assert.equal(result.savedAlerts,3);
 assert.deepEqual(calls.provision,["owner"]);
 assert.equal(calls.integration[0].where.userId,"owner");
 assert.equal(calls.history[0].where.userId,"owner");
 assert.equal(JSON.stringify(result).includes("DEKONICA_MAIL_PASSWORD"),false);
});
test("enabled mailbox with successful sync includes explicit last successful date",async()=>{
 const date=new Date("2026-11-20T11:00:00Z");
 const {service}=harness({mail:{id:"mail-2",type:"MAIL",provider:"HOME_PL",
  enabled:true,lastSyncAt:date,
  config:{email:"office@dekonica.com",passwordEnv:"DEKONICA_MAIL_PASSWORD"}}});
 const result=await service.mail("owner");
 assert.equal(result.state,"SYNCED");
 assert.equal(result.lastSuccessfulSyncAt,date);
 assert.equal(result.canEnable,false);
 assert.equal(result.externalSendingEnabled,false);
});
test("owner disabled, invalid integration and disabled financial agent are distinct",async()=>{
 const bad=harness({mail:{id:"mail-id",enabled:true,type:"MAIL",provider:"HOME_PL",
  lastSyncAt:null,config:{email:"hacker@example.com",passwordEnv:"JWT_SECRET"}}});
 assert.equal((await bad.service.mail("owner")).state,"INVALID_CONFIGURATION");
 const off=harness({agent:{enabled:false,status:"DISABLED",config:null},
  mail:{id:"mail-id",type:"MAIL",provider:"HOME_PL",enabled:true,lastSyncAt:null,
   config:{email:"office@dekonica.com",passwordEnv:"DEKONICA_MAIL_PASSWORD"}}});
 assert.equal((await off.service.mail("owner")).state,"AGENT_DISABLED");
});
test("other users do not receive mailbox readiness or KSeF progress",async()=>{
 const {service,calls}=harness({env:{...mailEnv,...ksefEnv}});
 await assert.rejects(service.mail("other"),error=>error.status===403);
 await assert.rejects(service.ksef("other"),error=>error.status===403);
 assert.deepEqual(calls.provision,[]);
 assert.deepEqual(calls.integration,[]);
 assert.deepEqual(calls.agent,[]);
});
test("KSeF history progress separates Dekonica and Deherus cursor values",async()=>{
 const {service,calls}=harness({env:{...mailEnv,...ksefEnv}});
 const result=await service.ksef("owner");
 assert.equal(result.ownerSyncStatus,"READY");
 assert.equal(result.agentEnabled,true);
 assert.equal(result.companies.length,2);
 assert.equal(result.companies[0].company,"Dekonica");
 assert.equal(result.companies[0].syncConfigured,true);
 assert.equal(result.companies[1].company,"Deherus");
 assert.equal(result.companies[1].syncConfigured,false);
 assert.equal(result.companies[0].history.checkpointAt,"2026-10-01T00:00:00.000Z");
 assert.equal(result.companies[1].history.checkpointAt,"2026-08-01T00:00:00.000Z");
 assert.ok(result.companies[0].history.progressPercent>result.companies[1].history.progressPercent);
 assert.ok(result.companies[0].history.remainingDays<result.companies[1].history.remainingDays);
 assert.equal(result.companies[0].history.complete,false);
 assert.equal(calls.agent[0].where.userId_key.userId,"owner");
 assert.equal(JSON.stringify(result).includes("TEST-ONLY-TOKEN"),false);
 assert.equal(JSON.stringify(result).includes("1234567890"),false);
});
test("progress cannot exceed 100% and uses February history baseline",()=>{
 const future=progress("2026-12-01T00:00:00.000Z",NOW);
 assert.equal(future.progressPercent,100);
 assert.equal(future.remainingDays,0);
 assert.equal(future.complete,true);
 const origin=progress("2026-02-01T00:00:00.000Z",NOW);
 assert.equal(origin.progressPercent,0);
 assert.ok(origin.remainingDays>200);
 assert.equal(validOwner("x"," x"),false);
});
test("routes and two screens show only authenticated private operational status",()=>{
 const ar=fs.readFileSync(path.join(__dirname,"../api/routes/agentRoutes.js"),"utf8");
 const fr=fs.readFileSync(path.join(__dirname,"../api/routes/financeRoutes.js"),"utf8");
 const mails=fs.readFileSync(path.join(__dirname,"../frontend/src/app/agents/mail/alerts/page.js"),"utf8");
 const ksef=fs.readFileSync(path.join(__dirname,"../frontend/src/app/finance/history-status/page.js"),"utf8");
 const agentService=fs.readFileSync(path.join(__dirname,"../api/services/AgentService.js"),"utf8");
 const api=fs.readFileSync(path.join(__dirname,"../frontend/src/lib/api.js"),"utf8");
 assert.match(ar,/router\.get\("\/mail\/status",verifyToken/);
 assert.match(fr,/router\.get\("\/history\/status",verifyToken/);
 assert.match(mails,/getHomePlMailStatus\(\)/);
 assert.match(mails,/Włącz monitorowanie poczty/);
 assert.match(mails,/setIntegrationEnabled\(mailStatus\.integrationId,next\)/);
 assert.match(ksef,/getKsefHistoryStatus\(\)/);
 assert.match(ksef,/queueKsefHistoryImport\(\)/);
 assert.match(ksef,/checkpointAt/);
 assert.match(api,/export async function getHomePlMailStatus/);
 assert.match(agentService,/if \(enabled && integration\.type === "MAIL"/);
 assert.match(agentService,/data:\{nextRunAt:new Date\(\)\}/);
});
