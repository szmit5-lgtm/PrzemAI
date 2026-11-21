"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs/promises");
const path=require("node:path");

async function helpers(){
 const source=await fs.readFile(path.join(__dirname,"../frontend/src/lib/financePeriodRows.js"),"utf8");
 return import("data:text/javascript;base64,"+Buffer.from(source).toString("base64"));
}
test("monthly KSeF report maintains distinct currencies, directions and periods",async()=>{
 const {groupKsefPeriods}=await helpers();
 const rows=[
  {month:1,currency:"PLN",direction:"INCOMING",gross:"100.25",count:2},
  {month:1,currency:"PLN",direction:"INCOMING",gross:"0.05",count:1},
  {month:2,currency:"PLN",direction:"INCOMING",gross:"-0.10",count:1},
  {month:2,currency:"PLN",direction:"OUTGOING",gross:"50.50",count:1},
  {month:1,currency:"EUR",direction:"INCOMING",gross:"20.35",count:1}
 ];
 const periods=groupKsefPeriods(rows);
 assert.equal(periods.length,4);
 const jan=periods.find(p=>p.period===1&&p.currency==="PLN"&&p.direction==="INCOMING");
 assert.equal(jan.grossCents,10030n);
 assert.equal(jan.count,3);
 const eur=periods.find(p=>p.currency==="EUR");
 assert.equal(eur.grossCents,2035n);
 const sale=periods.find(p=>p.direction==="OUTGOING");
 assert.equal(sale.grossCents,5050n);
});
test("quarterly KSeF report sums money in cents without currency conversion or floats",async()=>{
 const {groupKsefPeriods}=await helpers();
 const rows=[
  {month:1,currency:"PLN",direction:"INCOMING",gross:"0.10",count:1},
  {month:2,currency:"PLN",direction:"INCOMING",gross:"0.20",count:1},
  {month:3,currency:"PLN",direction:"INCOMING",gross:"0.30",count:1},
  {month:4,currency:"PLN",direction:"INCOMING",gross:"1.00",count:2},
  {month:3,currency:"USD",direction:"INCOMING",gross:"10.00",count:1}
 ];
 const q=groupKsefPeriods(rows,{quarterly:true});
 assert.equal(q.length,3);
 assert.equal(q.find(p=>p.period===1&&p.currency==="PLN").grossCents,60n);
 assert.equal(q.find(p=>p.period===1&&p.currency==="PLN").count,3);
 assert.equal(q.find(p=>p.period===2).grossCents,100n);
 assert.equal(q.find(p=>p.currency==="USD").grossCents,1000n);
});
test("invalid or incomplete KSeF rows are not silently counted as zero",async()=>{
 const {groupKsefPeriods}=await helpers();
 const rows=[
  {month:13,currency:"PLN",direction:"INCOMING",gross:"1.00",count:1},
  {month:1,currency:"PLN",direction:"INCOMING",gross:null,count:1},
  {month:1,currency:"PLN",direction:"INCOMING",gross:"NaN",count:2},
  {month:1,currency:"PLN",direction:"INCOMING",gross:"25.009",count:1},
  {month:1,currency:"PLN",direction:"UNKNOWN",gross:"25.00",count:1},
  {month:1,currency:"PLN",direction:"INCOMING",gross:"24.00",count:1}
 ];
 const result=groupKsefPeriods(rows);
 assert.equal(result.length,1);
 assert.equal(result[0].grossCents,2400n);
});
test("large amounts preserve exact cents when grouped",async()=>{
 const {groupKsefPeriods,formatKsefCents}=await helpers();
 const rows=[{month:1,currency:"PLN",direction:"INCOMING",gross:"999999999999999.99",count:1},
  {month:2,currency:"PLN",direction:"INCOMING",gross:"0.01",count:1}];
 const group=groupKsefPeriods(rows,{quarterly:true});
 assert.equal(group[0].grossCents,100000000000000000n);
 assert.match(formatKsefCents(group[0].grossCents,"PLN"),/PLN/);
});
test("company report page reads authenticated company-specific API and does not invent cashflow",async()=>{
 const ui=await fs.readFile(path.join(__dirname,"../frontend/src/app/company/[id]/finance/reports/page.js"),"utf8");
 const finance=await fs.readFile(path.join(__dirname,"../frontend/src/app/company/[id]/finance/page.js"),"utf8");
 const bank=await fs.readFile(path.join(__dirname,"../api/services/OrganizationFinanceService.js"),"utf8");
 assert.match(ui,/getOrganizationFinanceAnnualReport\(id,year\)/);
 assert.match(ui,/org\?\.data\?\.id!==id/);
 assert.match(ui,/report\?\.data\?\.source!=="KSEF"/);
 assert.match(ui,/groupKsefPeriods\(rows,\{quarterly:true\}\)/);
 assert.match(ui,/Kwoty nie są saldem bankowym/);
 assert.match(ui,/Raport jest dostępny tylko osobom z indywidualnym dostępem/);
 assert.match(finance,/status\?\.canView&&<Link href=\{"\/company\/"\+encodeURIComponent\(id\)\+"\/finance\/reports"\}/);
 assert.match(bank,/async annualReport\(userId,organizationId,yearInput\)/);
 assert.match(bank,/const link=await this\.accessible\(userId,organizationId\);/);
});
