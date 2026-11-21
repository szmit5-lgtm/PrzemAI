"use strict";

// Read-only suggestions only. No invoice receives a PAID status, and no
// bank operation is modified. One-to-one candidates must be unambiguous.
const MAX_INVOICES=5000;
const MAX_OPERATIONS=20000;
const MAX_SUGGESTIONS=1000;
const DAY_MS=86400000;
function amountCents(input) {
 const value=String(input??"").trim();
 const match=/^(-?)(\d{1,16})(?:\.(\d{1,2}))?$/.exec(value);
 if(!match)return null;
 const valueInCents=BigInt(match[2])*100n+BigInt((match[3]||"").padEnd(2,"0")||"0");
 return match[1]==="-"?-valueInCents:valueInCents;
}
function displayMoney(cents){
 const abs=cents<0n?-cents:cents;
 return (cents<0n?"-":"")+(abs/100n).toString()+"."+String(abs%100n).padStart(2,"0");
}
function normalizeText(text) {
 return String(text||"").normalize("NFKD").replace(/[\u0300-\u036f]/g,"")
  .toUpperCase().replace(/Ł/g,"L").replace(/[^A-Z0-9]+/g," ").trim();
}
function invoiceNumberPattern(value) {
 const tokens=normalizeText(value).split(/\s+/).filter(Boolean);
 const significant=tokens.join("");
 const digits=(significant.match(/\d/g)||[]).length;
 if(significant.length<8||significant.length>90||digits<4)return null;
 if(tokens.some(token=>token.length>40))return null;
 // Token boundaries and separators must be respected: invoice 123/2026
 // must never match e.g. 9123/20268.
 const inner=tokens.join("[^A-Z0-9]*");
 return new RegExp("(?:^|[^A-Z0-9])"+inner+"(?:$|[^A-Z0-9])");
}
function day(value) {
 if(!value)return null;
 const d=new Date(value);
 return Number.isFinite(d.getTime())?Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate()):null;
}
function confidenceName(invoice,tx) {
 const source=invoice.direction==="INCOMING"?invoice.sellerName:invoice.buyerName;
 const words=normalizeText(source).split(" ").filter(x=>x.length>=5&&
  !["SPOLKA","OGRANICZONA","ODPOWIEDZIALNOSCIA","SPOLKA","ZOO","POLSKA"].includes(x));
 if(!words.length)return false;
 const text=" "+normalizeText(String(tx.counterparty||"")+" "+String(tx.description||""))+" ";
 return words.some(x=>text.includes(" "+x+" "));
}
function suggestMatches(invoices,operations,companyNip,{maxSuggestions=MAX_SUGGESTIONS}={}) {
 const proposed=[];
 const conflicts=[];
 const byInvoice=new Map();
 const byTransaction=new Map();
 const counts={invoicesExamined:0,operationsExamined:0,ambiguous:0};
 const candidates=[];
 const invoicesSorted=[...invoices].sort((a,b)=>String(a.id).localeCompare(String(b.id)));
 const transactions=operations.filter(t=>t.reviewStatus==="UNMATCHED"&&
  t.bankAccount?.accountType!=="VAT"&&t.bankAccount?.currency);
 counts.operationsExamined=transactions.length;
 // Index once by exact bank amount and currency to keep a large historical
 // report linear rather than comparing every invoice with every transaction.
 const byAmount=new Map();
 for(const tx of transactions){
  const amount=amountCents(tx.amount);
  if(amount===null)continue;
  const key=tx.bankAccount.currency+"|"+amount.toString();
  if(!byAmount.has(key))byAmount.set(key,[]);
  byAmount.get(key).push(tx);
 }
 for(const inv of invoicesSorted) {
  // Only non-negative gross invoices tied to exactly one direction of
  // the selected company's NIP. Never match both-sides or unknown NIPs.
  if(inv.source!=="KSEF"||!inv.id||!inv.issueDate||
   !["INCOMING","OUTGOING"].includes(inv.direction))continue;
  const inbound=inv.buyerNip===companyNip&&inv.sellerNip!==companyNip;
  const outbound=inv.sellerNip===companyNip&&inv.buyerNip!==companyNip;
  if(!((inbound&&inv.direction==="INCOMING")||(outbound&&inv.direction==="OUTGOING")))continue;
  const cents=amountCents(inv.grossAmount);
  if(cents===null||cents<=0n||!/^[A-Z]{3}$/.test(String(inv.currency||"")))continue;
  const issued=day(inv.issueDate);
  if(issued===null)continue;
  counts.invoicesExamined++;
  const reference=invoiceNumberPattern(inv.invoiceNumber);
  const matching=[];
  for(const tx of byAmount.get(inv.currency+"|"+(inv.direction==="INCOMING"?-cents:cents).toString())||[]){
   const booked=day(tx.bookedAt);
   if(booked===null||booked<issued||booked>issued+180*DAY_MS)continue;
   const narrative=[tx.description,tx.reference].filter(Boolean).join(" ");
   const exact=reference&&reference.test(normalizeText(narrative));
   const name=confidenceName(inv,tx);
   if(!exact&&!name)continue;
   matching.push({invoice:inv,transaction:tx,reason:exact?"INVOICE_NUMBER_AMOUNT_DATE":"AMOUNT_DATE_COUNTERPARTY",
    confidence:exact?"STRONG":"REVIEW"});
  }
  // Multiple bank transactions for the same invoice may indicate
  // instalments or a duplicate entry; never claim a unique match.
  for(const c of matching){
   candidates.push(c);
   byInvoice.set(inv.id,(byInvoice.get(inv.id)||0)+1);
   byTransaction.set(c.transaction.id,(byTransaction.get(c.transaction.id)||0)+1);
  }
 }
 for(const c of candidates){
  const ambiguous=byInvoice.get(c.invoice.id)!==1||byTransaction.get(c.transaction.id)!==1;
  const view={
   invoiceId:c.invoice.id,invoiceNumber:c.invoice.invoiceNumber,
   direction:c.invoice.direction,invoiceDate:new Date(c.invoice.issueDate).toISOString().slice(0,10),
   contractor:c.invoice.direction==="INCOMING"?c.invoice.sellerName:c.invoice.buyerName,
   currency:c.invoice.currency,grossAmount:displayMoney(amountCents(c.invoice.grossAmount)),
   transactionId:c.transaction.id,bookedAt:new Date(c.transaction.bookedAt).toISOString().slice(0,10),
   accountSuffix:c.transaction.bankAccount.iban.slice(-4),
   transactionAmount:displayMoney(amountCents(c.transaction.amount)),
   description:String(c.transaction.description||"").slice(0,350),
   reason:c.reason,confidence:ambiguous?"AMBIGUOUS":c.confidence,
   verifiedPayment:false
  };
  if(ambiguous){counts.ambiguous++;if(conflicts.length<MAX_SUGGESTIONS)conflicts.push(view);}
  else if(proposed.length<maxSuggestions)proposed.push(view);
 }
 return {proposed,conflicts,
  totals:{...counts,uniqueProposals:proposed.length,conflictingCandidates:counts.ambiguous},
  note:"Propozycje na podstawie danych KSeF i przelewów. System nie potwierdza zapłaty, nie zmienia statusu faktur i nie uwzględnia częściowych płatności ani split payment."};
}
module.exports={amountCents,displayMoney,normalizeText,invoiceNumberPattern,suggestMatches,
 MAX_INVOICES,MAX_OPERATIONS};
