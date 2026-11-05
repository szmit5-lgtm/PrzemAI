"use strict";
function tidy(value,max=110){
  if(typeof value!=="string")return "";
  return value.replace(/\p{Cc}/gu," ").replace(/\s+/g," ").trim().slice(0,max);
}
function financialDocumentLabel(record={}) {
  const analysis=record.metadata?.analysis;
  const title=tidy(analysis?.title,125);
  if(title) return title;
  const direction=record.direction==="OUTGOING"?"Sprzedaż":record.direction==="INCOMING"?"Zakup":"Faktura";
  const partner=tidy(record.direction==="OUTGOING"?record.buyerName:record.sellerName,90);
  const number=tidy(record.invoiceNumber,60);
  return [direction,partner,number].filter(Boolean).join(" · ")||"Faktura z KSeF";
}
module.exports={financialDocumentLabel};
