"use strict";
const prisma=require("../../lib/prisma");
const AIEngine=require("../../core/ai/AIEngine");
const {getAgentDefinition}=require("../../lib/agentCatalog");
const {appendTurn,buildConversationPrompt,safeTurns}=require("../../lib/agentConversation");
class BusinessTaskAgent{
 constructor({db=prisma,ai=null}={}){this.db=db;this.ai=ai;}
 async run({userId,agentKey}={}){
  const def=getAgentDefinition(agentKey);
  if(!def||def.mode!=="TASK_DRAFT"||!userId)throw Error("Nieobsługiwane zlecenie.");
  const tasks=await this.db.task.findMany({
   where:{userId,source:"AGENT",status:"TODO",metadata:{path:["agentKey"],equals:agentKey}},
   orderBy:{createdAt:"asc"},take:3
  });
  if(!tasks.length)return{summary:def.name+": brak zleceń.",metadata:{completed:0,failed:0}};
  const ai=this.ai||new AIEngine();
  let completed=0,failed=0;
  for(const task of tasks){
   const lock=await this.db.task.updateMany({
    where:{id:task.id,userId,source:"AGENT",status:"TODO",metadata:{path:["agentKey"],equals:agentKey}},
    data:{status:"IN_PROGRESS",startedAt:new Date()}
   });
   if(lock.count!==1)continue;
   const m=task.metadata&&typeof task.metadata==="object"&&!Array.isArray(task.metadata)?task.metadata:{};
   try{
    const result=await ai.ask({
     system:"Jesteś "+def.name+" w PrzemAI. "+def.description+
      " Odpowiadaj po polsku. Wykonujesz analizę, piszesz szkice i plany działań wyłącznie na podstawie informacji dostarczonych w zleceniu. "+
      "Nie masz dostępu do aktualnego internetu, poczty, CRM zewnętrznych firm, banków ani WhatsApp. "+
      "Nie twierdź, że wysłałeś ofertę, znalazłeś nowych klientów, sprawdziłeś przetarg lub wykonałeś operację zewnętrzną. "+
      "Nie wymyślaj cen, klientów, faktów ani kontaktów. Jeśli brak danych, wymień potrzebne informacje. "+
      "Pokaż konkretne wyniki i następne kroki; ewentualne wysłanie wiadomości wymaga akceptacji użytkownika.",
     user:buildConversationPrompt(task),
     model:"gpt-5.5"
    });
    if(typeof result!=="string"||!result.trim())throw Error("Pusta odpowiedź.");
    const conversation=safeTurns(m.conversation);
    const turns=conversation.length?conversation:[
      {role:"user",content:String(task.description||task.title||"").slice(0,8000),
        at:task.createdAt?.toISOString?.()||null}
    ];
    const updatedConversation=appendTurn(turns,"assistant",result.slice(0,16000));
    const update=await this.db.task.updateMany({
     where:{id:task.id,userId,source:"AGENT",status:"IN_PROGRESS"},
     data:{status:"DONE",completedAt:new Date(),metadata:{...m,result:result.slice(0,45000),conversation:updatedConversation,resultStatus:"DRAFT_READY",processedAt:new Date().toISOString()}}
    });
    if(update.count===1)completed++;
   }catch(error){
    failed++;
    await this.db.task.updateMany({
     where:{id:task.id,userId,source:"AGENT",status:"IN_PROGRESS"},
     data:{status:"ERROR",metadata:{...m,resultStatus:"FAILED",error:"Nie udało się opracować zlecenia."}}
    });
    console.error("[BusinessTaskAgent] Failed",def.key,error?.name||"Error");
   }
  }
  return{summary:def.name+": opracowano "+completed+" zleceń, błędy "+failed+".",metadata:{completed,failed}};
 }
}
module.exports=BusinessTaskAgent;
