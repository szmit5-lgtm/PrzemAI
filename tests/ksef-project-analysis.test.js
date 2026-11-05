"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { analyzeKsefXml } = require("../connectors/ksef/analyzeKsefXml");
const xml = `<?xml version="1.0"?><Faktura><Fa><FaWiersz><P_7>Instalacja CO Zgorzelec</P_7></FaWiersz>
<FaWiersz><P_7>Montaz grzejnikow</P_7></FaWiersz></Fa>
<Platnosc><TerminPlatnosci><Termin>2026-11-21</Termin></TerminPlatnosci></Platnosc></Faktura>`;
test("describes invoice lines and extracts due date only from payment terms",()=>{
 const out=analyzeKsefXml(xml, []);
 assert.match(out.description,/Instalacja CO Zgorzelec/);
 assert.equal(out.itemCount,2);
 assert.equal(out.dueDate.toISOString(),"2026-11-21T12:00:00.000Z");
 assert.equal(out.projectDecision,"REVIEW_REQUIRED");
});
test("matches only a unique project explicit in line descriptions",()=>{
 const out=analyzeKsefXml(xml,[{id:"project1",name:"Zgorzelec",aliases:[],status:"ACTIVE"},
 {id:"project2",name:"Mielno",aliases:[],status:"ACTIVE"}]);
 assert.equal(out.projectId,"project1");
 assert.equal(out.projectDecision,"AUTO_ASSIGNED");
});
test("ambiguous matches never auto-assign",()=>{
 const out=analyzeKsefXml(xml,[{id:"p1",name:"Zgorzelec",aliases:[]},
 {id:"p2",name:"Instalacja CO Zgorzelec",aliases:[]}]);
 assert.equal(out.projectId,null);
 assert.equal(out.projectDecision,"AMBIGUOUS");
});
test("seller address or invoice number alone cannot cause project assignment",()=>{
 const different=xml.replace("Instalacja CO Zgorzelec","Montaż instalacji");
 const out=analyzeKsefXml(different.replace("</Faktura>","<Podmiot1><Nazwa>Zgorzelec</Nazwa></Podmiot1></Faktura>"),
 [{id:"p1",name:"Zgorzelec",aliases:[]}]);
 assert.equal(out.projectId,null);
});
test("rejects dangerous XML declarations",()=>{
 assert.throws(()=>analyzeKsefXml('<!DOCTYPE Faktura><Faktura/>'),/Invalid/);
});
