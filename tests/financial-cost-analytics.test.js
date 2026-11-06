"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const {
  financeClass,validateFinanceClass,summarizePeriods
}=require("../lib/financeClassification");

const doc=(direction,date,gross,description,manual=null, currency="PLN")=>({
  source:"KSEF",direction,issueDate:new Date(date),grossAmount:gross,currency,
  sellerName:"Dostawca",metadata:{
    analysis:{description},
    ...(manual?{costAccounting:manual}:{})
  }
});
test("leasing car invoice suggests monthly fleet costs but cash flow stays unrelated",()=>{
 const car=doc("INCOMING","2026-04-02","1230.00","Rata leasingowa za samochody");
 assert.deepEqual(financeClass(car),{category:"FLEET",type:"FIXED",confidence:"MEDIUM",source:"SUGGESTED"});
});
test("vehicle purchase is an asset, not automatically a monthly expense",()=>{
 const car=doc("INCOMING","2026-04-02","125000.00","Zakup samochodu ciężarowego");
 assert.equal(financeClass(car).type,"CAPEX");
});
test("manually assigned fixed fleet category overrides auto suggestions",()=>{
 const car=doc("INCOMING","2026-04-02","500.00","Serwis opon",
  {category:"FLEET",type:"FIXED",source:"MANUAL"});
 assert.equal(financeClass(car).type,"FIXED");
 assert.equal(financeClass(car).source,"MANUAL");
});
test("unknown categories and foreign enum values cannot enter persistent metadata",()=>{
 assert.throws(()=>validateFinanceClass({category:"ADMIN",type:"FIXED"}),/Wybierz/);
 assert.throws(()=>validateFinanceClass({category:"FLEET",type:"INVALID"}),/Wybierz/);
 assert.deepEqual(validateFinanceClass({category:"FLEET",type:"FIXED"}),
   {category:"FLEET",type:"FIXED"});
});
test("monthly and quarterly invoice totals have separate sales vs purchases and currencies",()=>{
 const docs=[
   doc("OUTGOING","2026-01-01","2000.00","Usluga"),
   doc("INCOMING","2026-01-15","1230.10","Rata leasing za samochody"),
   doc("INCOMING","2026-04-02","100.05","Rata leasing za samochody"),
   doc("OUTGOING","2026-03-15","300.00","Usługa",null,"EUR"),
   doc("OUTGOING","2025-12-01","5000.00","poprzedni rok")
 ];
 const rows=summarizePeriods(docs,2026);
 const x=(period,number,group,cur="PLN")=>rows.find(r=>r.period===period&&r.number===number&&r.group===group&&r.currency===cur);
 assert.equal(x("MONTH",1,"INVOICED_SALES").gross,"2000.00");
 assert.equal(x("QUARTER",1,"INVOICED_PURCHASES").gross,"1230.10");
 assert.equal(x("QUARTER",2,"INVOICED_PURCHASES").gross,"100.05");
 assert.equal(x("QUARTER",1,"INVOICED_SALES","EUR").gross,"300.00");
 assert.equal(x("QUARTER",1,"INVOICED_PURCHASES").costType,"FIXED");
 assert.equal(rows.some(r=>r.gross==="5000.00"),false);
});
test("monetary precision is decimal cents, never floating point accumulated",()=>{
 const docs=Array.from({length:100},()=>doc("OUTGOING","2026-02-07","0.01","x"));
 const r=summarizePeriods(docs,2026).find(x=>x.period==="MONTH");
 assert.equal(r.gross,"1.00");
});
