"use strict";

// A conversation belongs to one Task. Keep the original assignment and last
// responses together, including legacy one-shot results created before chat.
const MAX_TURNS=32;
const MAX_MESSAGE=16000;
function safeTurns(value){
  if(!Array.isArray(value))return [];
  return value.filter(t=>t && (t.role==="user"||t.role==="assistant") &&
    typeof t.content==="string" && t.content.trim()).slice(-MAX_TURNS)
    .map(t=>({role:t.role,content:t.content.slice(0,MAX_MESSAGE),
      at:typeof t.at==="string"?t.at:null}));
}
function initialTurns(task){
  const meta=task?.metadata||{};
  const history=safeTurns(meta.conversation);
  if(history.length)return history;
  const turns=[];
  if(typeof task?.description==="string"&&task.description.trim())
    turns.push({role:"user",content:task.description.slice(0,8000),at:task.createdAt?.toISOString?.()||null});
  if(typeof meta.result==="string"&&meta.result.trim())
    turns.push({role:"assistant",content:meta.result.slice(0,MAX_MESSAGE),at:meta.processedAt||null});
  return turns;
}
function appendTurn(turns,role,content,now=new Date()){
  return [...safeTurns(turns),{role,content:String(content).trim().slice(0,MAX_MESSAGE),
    at:now.toISOString()}].slice(-MAX_TURNS);
}
function buildConversationPrompt(task){
  const meta=task?.metadata||{};
  const history=safeTurns(meta.conversation);
  const latest=history.length?history.slice(-16):[
    {role:"user",content:String(task?.description||task?.title||"").slice(0,8000)}
  ];
  return JSON.stringify({
    initialAssignment:String(task?.description||task?.title||"").slice(0,8000),
    company:meta.company||null,client:meta.client||null,
    contact:meta.contact||null,project:meta.project||null,stage:meta.stage||null,
    previousConversation:latest.map(t=>({role:t.role,content:t.content.slice(0,5000)})),
    instruction:"Odpowiedz na ostatnią wiadomość użytkownika, kontynuując tę samą sprawę. Nie wracaj do pytań, na które już odpowiedział."
  });
}
module.exports={safeTurns,initialTurns,appendTurn,buildConversationPrompt};
