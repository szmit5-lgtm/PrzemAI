"use strict";
const prisma=require("../../lib/prisma");
const AIEngine=require("../../core/ai/AIEngine");
const {getAgentDefinition}=require("../../lib/agentCatalog");
const {appendTurn,buildConversationPrompt,safeTurns}=require("../../lib/agentConversation");
// Public-source discovery is opt-in per sales assignment and never sends messages.
async function discoverPublicSources(query) {
 const q=String(query||"").replace(/https?:\/\/\S+/g," ").replace(/\s+/g," ").trim().slice(0,180);
 if(!q)return [];
 const controller=new AbortController();
 const timer=setTimeout(()=>controller.abort(),9000);
 try {
  const url="https://www.bing.com/search?format=rss&q="+encodeURIComponent(q);
  const response=await fetch(url,{signal:controller.signal,headers:{"User-Agent":"PrzemAI/1.0 (public research; read-only)"}});
  if(!response.ok)throw Error("Search HTTP "+response.status);
  const xml=await response.text();
  const decode=t=>t.replace(/<!\[CDATA\[([\s\S]*?)\]>/g,"$1").replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&quot;/g,'"').replace(/&#39;/g,"'");
  const items=[...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].slice(0,20);
  const seen=new Set(),results=[];
  for(const [,item] of items){
   const field=name=>decode((item.match(new RegExp("<"+name+">([\\s\\S]*?)<\\/"+name+">"))||[])[1]||"").trim();
   const link=field("link"),title=field("title");
   let u;try{u=new URL(link);}catch{continue;}
   if(u.protocol!=="https:"||!title||seen.has(u.hostname.toLowerCase()))continue;
   seen.add(u.hostname.toLowerCase());
   results.push({title:title.slice(0,180),url:u.href,description:field("description").replace(/<[^>]*>/g,"").slice(0,300)});
   if(results.length===10)break;
  }
  return results;
 }finally{clearTimeout(timer);}
}
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
    // Search only for explicit public-client discovery tasks. No search on
    // ordinary conversations, and no claim that a search hit is a qualified lead.
    const wantsSearch=agentKey==="sales" && /(?:wyszukaj|znajdź|poszukaj|szukaj).{0,100}(?:klient|firm|odbiorc|instalator|dystrybutor)/i.test(String(task.description||""));
    let sources=[];
    if(wantsSearch){
     const searchQuery=String(m.searchQuery||task.description||task.title||"").replace(/^(?:wyszukaj|znajdź|poszukaj|szukaj)\s+/i,"").slice(0,180);
     sources=await discoverPublicSources(searchQuery);
     if(!sources.length)throw Error("Brak wyników publicznego wyszukiwania; nie generuję fikcyjnych leadów.");
     console.log("[BusinessTaskAgent] Public source candidates",JSON.stringify({agentKey,count:sources.length}));
    }
    const result=await ai.ask({
     system:"Jesteś "+def.name+" w PrzemAI. "+def.description+
      " Odpowiadaj po polsku. Wykonujesz analizę, piszesz szkice i plany działań wyłącznie na podstawie informacji dostarczonych w zleceniu. "+
      "Masz dostęp wyłącznie do podanych poniżej wyników publicznej wyszukiwarki, jeśli zostały dołączone. Są to kandydaci do weryfikacji, nie potwierdzeni klienci. Nie masz dostępu do poczty, CRM zewnętrznych firm, banków ani WhatsApp. "+
      "Nie twierdź, że wysłałeś ofertę, znalazłeś nowych klientów, sprawdziłeś przetarg lub wykonałeś operację zewnętrzną. "+
      "Nie wymyślaj cen, klientów, faktów ani kontaktów. Jeśli brak danych, wymień potrzebne informacje. "+
      "Pokaż konkretne wyniki i następne kroki; ewentualne wysłanie wiadomości wymaga akceptacji użytkownika.",
     user:buildConversationPrompt(task)+(sources.length?"\n\nPUBLICZNE WYNIKI WYSZUKIWANIA (niezweryfikowane kontakty; cytuj URL, deduplikuj firmy):\n"+JSON.stringify(sources):""),
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
     data:{status:"DONE",completedAt:new Date(),metadata:{...m,result:result.slice(0,45000),conversation:updatedConversation,publicSources:sources,resultStatus:"DRAFT_READY",processedAt:new Date().toISOString()}}
    });
    if(update.count===1){completed++;console.log("[BusinessTaskAgent] Draft saved",JSON.stringify({agentKey,publicSources:sources.length}));}
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
