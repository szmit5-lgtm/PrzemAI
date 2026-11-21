"use strict";
const prisma=require("../../lib/prisma");
const AgentService=require("./AgentService");
const {isAuthorizedDekonicaUser,canSyncMailIntegration}=require("../../lib/mailAccessPolicy");
const {getKsefHistoryCursor,HISTORY_START}=require("../../lib/ksefHistoryCursor");
const {getKsefSyncEligibility}=require("../../lib/ksefSyncEligibility");

function validOwner(actor,owner){
 return typeof actor==="string"&&actor.trim()&&actor===actor.trim()&&
  typeof owner==="string"&&owner.trim()&&owner===owner.trim()&&actor===owner;
}
function progress(cursor,now){
 const recent=new Date(new Date(now).getTime()-86400000);
 const start=Date.parse(HISTORY_START);
 const cutoff=recent.getTime();
 const checkpoint=Date.parse(cursor);
 const duration=Math.max(1,cutoff-start);
 const completed=Math.max(0,Math.min(duration,checkpoint-start));
 return {startAt:HISTORY_START,checkpointAt:cursor,
  recentCutoffAt:recent.toISOString(),
  progressPercent:Math.round(100*completed/duration),
  remainingDays:Math.ceil(Math.max(0,cutoff-checkpoint)/86400000),
  complete:checkpoint>=cutoff};
}
class OperationalStatusService{
 constructor({db=prisma,env=process.env,provision=new AgentService(),now=()=>new Date()}={}){
  this.db=db;this.env=env;this.provision=provision;this.now=now;
 }
 async mail(userId){
  if(!isAuthorizedDekonicaUser(userId,this.env))
   throw Object.assign(new Error("Nie masz dostępu do poczty Dekonica."),{status:403});
  // Existing provisioner cannot activate the mailbox by itself: new
  // integrations remain disabled until an explicit owner click.
  await this.provision.ensureDefaults(userId);
  const [integration,agent,alerts]=await Promise.all([
   this.db.integration.findFirst({where:{userId,type:"MAIL",provider:"HOME_PL",name:"Dekonica office"},
    select:{id:true,enabled:true,lastSyncAt:true,config:true,type:true,provider:true}}),
   this.db.agent.findUnique({where:{userId_key:{userId,key:"financial"}},
    select:{enabled:true,status:true,lastRunAt:true,nextRunAt:true}}),
   this.db.history.count({where:{userId,type:"DEKONICA_MAIL_ALERT"}})
  ]);
  const valid=integration?canSyncMailIntegration(userId,integration,this.env):false;
  const enabled=Boolean(integration?.enabled&&valid);
  let state="NOT_PROVISIONED";
  if(integration&&!valid)state="INVALID_CONFIGURATION";
  else if(integration&&!integration.enabled)state="DISABLED";
  else if(enabled&&!agent?.enabled)state="AGENT_DISABLED";
  else if(enabled&&agent?.enabled&&!integration.lastSyncAt)state="AWAITING_FIRST_SYNC";
  else if(enabled&&agent?.enabled&&integration.lastSyncAt)state="SYNCED";
  return {mailbox:"office@dekonica.com",state,enabled,canEnable:Boolean(integration&&valid&&!enabled),
   integrationId:integration?.id||null,lastSuccessfulSyncAt:integration?.lastSyncAt||null,
   agentEnabled:Boolean(agent?.enabled),agentStatus:agent?.status||"UNKNOWN",
   nextAgentRunAt:agent?.nextRunAt||null,
   savedAlerts:alerts,externalSendingEnabled:false,
   note:"Ostatnia udana synchronizacja nie gwarantuje odczytania całej skrzynki. Agent sprawdza ograniczoną liczbę najnowszych wiadomości."};
 }
 async ksef(userId){
  if(!validOwner(userId,this.env.KSEF_OWNER_USER_ID))
   throw Object.assign(new Error("Nie masz dostępu do statusu KSeF."),{status:403});
  const agent=await this.db.agent.findUnique({where:{userId_key:{userId,key:"financial"}},
   select:{config:true,enabled:true,status:true,lastRunAt:true,nextRunAt:true}});
  const now=this.now();
  const dekonica=progress(getKsefHistoryCursor(agent?.config,"dekonica",now),now);
  const deherus=progress(getKsefHistoryCursor(agent?.config,"deherus",now),now);
  const eligibility=getKsefSyncEligibility(userId,this.env);
  return {ownerSyncStatus:eligibility.status,agentEnabled:Boolean(agent?.enabled),
   agentStatus:agent?.status||"UNKNOWN",lastAgentRunAt:agent?.lastRunAt||null,
   nextAgentRunAt:agent?.nextRunAt||null,
   companies:[
    {company:"Dekonica",syncConfigured:eligibility.allowed,history:dekonica},
    {company:"Deherus",syncConfigured:eligibility.allowed&&
     this.env.KSEF_DEHERUS_SYNC_ENABLED==="true"&&
     this.env.KSEF_DEHERUS_NIP==="1133200454"&&
     Boolean(this.env.KSEF_DEHERUS_TOKEN),history:deherus}
   ],
   note:"Postęp obliczany na podstawie zapisanego kursora pobierania. Nie jest potwierdzeniem kompletności faktur ani załączników XML."};
 }
}
module.exports={OperationalStatusService,progress,validOwner};
