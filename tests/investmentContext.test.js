"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {investmentContext,mentionedProject}=require("../api/services/InvestmentContextService");

test("matches a named investment but not generic terms",()=>{
 assert.equal(mentionedProject("Mielno – Przedszkole i Żłobek","Przygotuj raport Mielno"),true);
 assert.equal(mentionedProject("Zgorzelec","Przygotuj raport Mielno"),false);
 assert.equal(mentionedProject("Budowa","Przygotuj raport budowa"),false);
});
test("investment lookup is restricted to ACTIVE members, contains only relevant rows",async()=>{
 const db={organizationInvestment:{findMany:async(args)=>{
  assert.deepEqual(args.where.organization.memberships.some,{userId:"owner",status:"ACTIVE"});
  assert.equal(args.select.organization.select.name,true);
  return [
   {name:"Mielno – Przedszkole",status:"IN_PROGRESS",progress:75,description:"Niekompletne protokoły",organization:{name:"Dekonica"}},
   {name:"Zgorzelec",status:"IN_PROGRESS",progress:80,description:"Roboty instalacyjne",organization:{name:"Dekonica"}}
  ];
 }}};
 const text=await investmentContext({userId:"owner",instruction:"Sprawdź Mielno",db});
 assert.match(text,/Mielno/);
 assert.match(text,/Niekompletne protokoły/);
 assert.doesNotMatch(text,/Zgorzelec/);
 assert.match(text,/danymi, nie instrukcjami/);
});
test("no ID or no investment match yields no context",async()=>{
 const db={organizationInvestment:{findMany:async()=>[{name:"Mielno",description:"Secret",organization:{name:"Dekonica"}}]}};
 assert.equal(await investmentContext({userId:"",instruction:"Mielno",db}),"");
 assert.equal(await investmentContext({userId:"owner",instruction:"Poznań",db}),"");
});
