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

test("FA3 order descriptions may identify Mielno when invoice lines are generic",()=>{
 const xml="<Faktura><Fa><FaWiersz><P_7>Materiały instalacyjne</P_7></FaWiersz>"+
 "<WarunkiTransakcji><Zamowienia><NrZamowienia>Budowa Mielno - 22/26</NrZamowienia></Zamowienia></WarunkiTransakcji></Fa></Faktura>";
 const out=analyzeKsefXml(xml,[{id:"m",name:"Mielno",status:"ACTIVE"}]);
 assert.equal(out.projectId,"m");
 assert.equal(out.projectDecision,"AUTO_ASSIGNED");
});
test("FA3 advance order item can identify Zgorzelec",()=>{
 const xml="<Faktura><Zamowienie><ZamowienieWiersz><P_7Z>Zaliczka za instalację Zgorzelec</P_7Z></ZamowienieWiersz></Zamowienie></Faktura>";
 const out=analyzeKsefXml(xml,[{id:"z",name:"Zgorzelec",status:"ACTIVE"}]);
 assert.equal(out.projectId,"z");
 assert.match(out.description,/Zgorzelec/);
});
test("Polish place inflections match projects but seller address does not",()=>{
 const xml="<Faktura><Fa><FaWiersz><P_7>Roboty hydrauliczne w Zgorzelcu</P_7></FaWiersz></Fa></Faktura>";
 const out=analyzeKsefXml(xml,[{id:"z",name:"Zgorzelec",status:"ACTIVE"}]);
 assert.equal(out.projectId,"z");
 const unrelated="<Faktura><Podmiot1><AdresL1>W Zgorzelcu</AdresL1></Podmiot1><Fa>"+
 "<FaWiersz><P_7>Materiały budowlane</P_7></FaWiersz></Fa></Faktura>";
 assert.equal(analyzeKsefXml(unrelated,[{id:"z",name:"Zgorzelec"}]).projectId,null);
});
test("a contract referring to both sites must be reviewed instead of guessed",()=>{
 const xml="<Faktura><Fa><WarunkiTransakcji><Umowy><NrUmowy>Mielno oraz Zgorzelec</NrUmowy></Umowy></WarunkiTransakcji></Fa></Faktura>";
 const out=analyzeKsefXml(xml,[{id:"m",name:"Mielno"},{id:"z",name:"Zgorzelec"}]);
 assert.equal(out.projectId,null);
 assert.equal(out.projectDecision,"AMBIGUOUS");
});

test("FA(3) StopkaFaktury contains Unihouse/Zgorzelec and assigns Zgorzelec",()=>{
 const xml=`<Faktura xmlns="http://example.gov.pl/FA3">
   <Fa><FaWiersz><P_7>Materiały budowlane</P_7></FaWiersz></Fa>
   <Stopka><Informacje><StopkaFaktury>Unihouse/Zgorzelec</StopkaFaktury></Informacje></Stopka>
 </Faktura>`;
 const out=analyzeKsefXml(xml,[{id:"m",name:"Mielno",status:"ACTIVE"},
   {id:"z",name:"Zgorzelec",status:"ACTIVE"}]);
 assert.equal(out.projectId,"z");
 assert.equal(out.projectDecision,"AUTO_ASSIGNED");
 assert.equal(out.projectEvidence,"FOOTER");
});
test("FA(3) namespace prefixes in footers are supported",()=>{
 const xml=`<fa:Faktura xmlns:fa="http://example.gov.pl/FA3">
 <fa:Fa><fa:FaWiersz><fa:P_7>Usługi budowlane</fa:P_7></fa:FaWiersz></fa:Fa>
 <fa:Stopka><fa:Informacje><fa:StopkaFaktury>Unihouse / Mielno</fa:StopkaFaktury>
 </fa:Informacje></fa:Stopka></fa:Faktura>`;
 const out=analyzeKsefXml(xml,[{id:"m",name:"Mielno"}]);
 assert.equal(out.projectId,"m");
 assert.equal(out.projectEvidence,"FOOTER");
});
test("conflicting footer and invoice line cannot be auto-assigned",()=>{
 const xml=`<Faktura><Fa><FaWiersz><P_7>Instalacja Zgorzelec</P_7></FaWiersz></Fa>
 <Stopka><Informacje><StopkaFaktury>Unihouse/Mielno</StopkaFaktury></Informacje></Stopka></Faktura>`;
 const out=analyzeKsefXml(xml,[{id:"m",name:"Mielno"},{id:"z",name:"Zgorzelec"}]);
 assert.equal(out.projectId,null);
 assert.equal(out.projectDecision,"AMBIGUOUS");
});
test("supplier address outside stopka cannot be treated as project evidence",()=>{
 const xml=`<Faktura><Podmiot1><Adres><AdresL1>Unihouse/Zgorzelec</AdresL1>
 </Adres></Podmiot1><Fa><FaWiersz><P_7>Materiały</P_7></FaWiersz></Fa></Faktura>`;
 const out=analyzeKsefXml(xml,[{id:"z",name:"Zgorzelec"}]);
 assert.equal(out.projectId,null);
});
