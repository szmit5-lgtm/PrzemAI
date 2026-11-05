"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {financialDocumentLabel}=require("../lib/financialDocumentLabel");
const {analyzeKsefXml}=require("../connectors/ksef/analyzeKsefXml");
const {ensureDekonicaProjects}=require("../connectors/ksef/ensureDekonicaProjects");

test("every metadata-only invoice gets a truthful preliminary name",()=>{
 assert.equal(financialDocumentLabel({source:"KSEF",direction:"INCOMING",
  sellerName:"Firma Dostawca",invoiceNumber:"FV/12"}),"Zakup · Firma Dostawca · FV/12");
 assert.equal(financialDocumentLabel({metadata:{analysis:{title:"Montaż grzejników"}}}),"Montaż grzejników");
 assert.equal(financialDocumentLabel({}),"Faktura");
});
test("extracted invoice item is the final title and project aliases match Polish accents",()=>{
 const xml="<Faktura><Fa><FaWiersz><P_7>Materiały do budowy Złotokłos</P_7></FaWiersz></Fa></Faktura>";
 const out=analyzeKsefXml(xml,[{id:"project-1",name:"Złotokłos",aliases:[],status:"ACTIVE"}]);
 assert.equal(out.title,"Materiały do budowy Złotokłos");
 assert.equal(out.projectDecision,"AUTO_ASSIGNED");
 assert.equal(out.projectId,"project-1");
});
test("pilot projects created only for explicitly authorized owner and idempotently",async()=>{
 let existing=[];const prisma={project:{
  async findMany(){return existing;},
  async create({data}){existing.push(data);return data;}
 }};
 const env={KSEF_OWNER_USER_ID:"owner",KSEF_SEED_DEKONICA_PROJECTS:"true"};
 assert.equal(await ensureDekonicaProjects({prisma,userId:"wrong",env}),0);
 assert.equal(await ensureDekonicaProjects({prisma,userId:"owner",env}),2);
 assert.equal(await ensureDekonicaProjects({prisma,userId:"owner",env}),0);
 assert.deepEqual(existing.map(x=>x.name),["Zgorzelec","Mielno"]);
});
