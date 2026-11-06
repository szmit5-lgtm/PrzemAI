"use strict";

const CATEGORIES = Object.freeze([
  {id:"FLEET",label:"Samochody i flota"},
  {id:"RENT",label:"Czynsz i lokale"},
  {id:"UTILITIES",label:"Media i energia"},
  {id:"PAYROLL",label:"Wynagrodzenia"},
  {id:"SOFTWARE",label:"Oprogramowanie i abonamenty"},
  {id:"MATERIALS",label:"Materiały budowlane"},
  {id:"SUBCONTRACTORS",label:"Podwykonawcy"},
  {id:"LOGISTICS",label:"Transport i logistyka"},
  {id:"TAXES",label:"Podatki i opłaty"},
  {id:"GENERAL",label:"Koszty ogólne"},
  {id:"OTHER",label:"Pozostałe / do klasyfikacji"}
]);
const TYPES = Object.freeze([
  {id:"FIXED",label:"Stały miesięczny"},
  {id:"VARIABLE",label:"Zmienny"},
  {id:"CAPEX",label:"Inwestycyjny / zakup aktywa"},
  {id:"ONE_OFF",label:"Jednorazowy"},
  {id:"UNCLASSIFIED",label:"Do określenia"}
]);
const allCategories = new Set(CATEGORIES.map(x=>x.id));
const allTypes = new Set(TYPES.map(x=>x.id));
const normalize = x => String(x||"").toLocaleLowerCase("pl-PL").replace(/ł/g,"l").normalize("NFD").replace(/[\u0300-\u036f]/g,"");
function suggestFinanceClass(document) {
  if(document?.direction !== "INCOMING")return {category:"OTHER",type:"UNCLASSIFIED",confidence:"NONE"};
  const meta = document.metadata || {};
  const text = normalize([
    meta.analysis?.title,meta.analysis?.description,
    document.sellerName,document.invoiceNumber
  ].filter(Boolean).join(" ")).slice(0,1700);
  const matches = regex => regex.test(text);
  const vehicle = matches(/\b(samochod\w*|auto\w*|pojazd\w*|leasing\w*|flot\w*|opon\w*|paliw\w*|tankowan\w*)\b/);
  if(vehicle){
    if(matches(/\b(zakup\w*|nabyci\w*|sprzedaz\w*)\b.*\b(samochod\w*|aut\w*|pojazd\w*)\b/))
      return {category:"FLEET",type:"CAPEX",confidence:"MEDIUM"};
    if(matches(/\b(leasing|rata leasing|najem dlugoterminowy|wynajem dlugoterminowy|abonament flot)\b/))
      return {category:"FLEET",type:"FIXED",confidence:"MEDIUM"};
    return {category:"FLEET",type:"VARIABLE",confidence:"LOW"};
  }
  if(matches(/\b(czynsz|najem lokalu|wynajem biura)\b/))
    return {category:"RENT",type:"FIXED",confidence:"MEDIUM"};
  if(matches(/\b(energia elektryczna|gaz|woda|prad|ogrzewanie)\b/))
    return {category:"UTILITIES",type:"VARIABLE",confidence:"MEDIUM"};
  if(matches(/\b(subskrypcja|licencja|abonament|software|hosting)\b/))
    return {category:"SOFTWARE",type:"FIXED",confidence:"LOW"};
  if(matches(/\b(montaz|roboty budowlane|podwykonaw)\b/))
    return {category:"SUBCONTRACTORS",type:"VARIABLE",confidence:"LOW"};
  if(matches(/\b(beton|material|stal|rura|grzejnik|plyta)\b/))
    return {category:"MATERIALS",type:"VARIABLE",confidence:"LOW"};
  if(matches(/\b(transport|przewoz|spedycja)\b/))
    return {category:"LOGISTICS",type:"VARIABLE",confidence:"MEDIUM"};
  return {category:"OTHER",type:"UNCLASSIFIED",confidence:"NONE"};
}
function financeClass(document){
  const manual=document?.metadata?.costAccounting;
  if(manual?.source==="MANUAL" && allCategories.has(manual.category) && allTypes.has(manual.type))
    return {category:manual.category,type:manual.type,source:"MANUAL",confidence:"CONFIRMED"};
  return {...suggestFinanceClass(document),source:"SUGGESTED"};
}
function validateFinanceClass(value){
  if(!value || !allCategories.has(value.category) || !allTypes.has(value.type))
    throw new Error("Wybierz poprawną kategorię i rodzaj kosztu.");
  return {category:value.category,type:value.type};
}
function toCents(value){
  if(value===null || value===undefined)return null;
  const str=String(value);
  const match=/^(-?)(\d{1,20})(?:\.(\d{1,2}))?$/.exec(str);
  if(!match)return null;
  const v=BigInt(match[2])*100n+BigInt((match[3]||"").padEnd(2,"0"));
  return match[1]==="-"?-v:v;
}
function formatCents(v){
  const negative=v<0n, a=negative?-v:v;
  return (negative?"-":"")+(a/100n).toString()+"."+(a%100n).toString().padStart(2,"0");
}
function summarizePeriods(documents, year){
  const aggregate=new Map();
  for(const d of documents){
    const date=d.issueDate instanceof Date?d.issueDate:new Date(d.issueDate);
    if(Number.isNaN(date.getTime())||date.getUTCFullYear()!==year)continue;
    if(d.source!=="KSEF" || !["INCOMING","OUTGOING"].includes(d.direction))continue;
    const amount=toCents(d.grossAmount);
    if(amount===null)continue;
    const month=date.getUTCMonth()+1;
    const quarter=Math.floor((month-1)/3)+1;
    const currency=d.currency||"PLN";
    const finance=d.direction==="INCOMING"?financeClass(d):null;
    const groupKey=d.direction==="OUTGOING"?"INVOICED_SALES":"INVOICED_PURCHASES";
    for(const [period,number] of [["MONTH",month],["QUARTER",quarter]]){
      const key=[period,number,currency,groupKey,finance?.category||"",finance?.type||""].join("|");
      if(!aggregate.has(key))aggregate.set(key,{period,number,currency,group:groupKey,
        category:finance?.category||null,costType:finance?.type||null,count:0,grossCents:0n});
      const row=aggregate.get(key);row.count++;row.grossCents+=amount;
    }
  }
  return [...aggregate.values()].map(({grossCents,...row})=>({...row,gross:formatCents(grossCents)}));
}
module.exports={CATEGORIES,TYPES,financeClass,validateFinanceClass,summarizePeriods};
