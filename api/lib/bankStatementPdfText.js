"use strict";
// Conservative, side-effect free preview for text-based Polish bank statement PDFs.
// Unsupported layouts are rejected rather than guessed or persisted.
const {parsePolishAmount}=require("./bankStatementCsv");
const AMOUNT=/-?(?:\d{1,3}(?:[ \u00a0]\d{3})+|\d+),\d{2}/g;
const ROW=/^\s*(\d{1,5})\s+(\d{2})[-.](\d{2})[-.](\d{4})\s+(.+)$/;
function iso(day,month,year){
 const v=`${year}-${month}-${day}`, d=new Date(v+"T12:00:00Z");
 if(Number.isNaN(d.getTime())||d.toISOString().slice(0,10)!==v)
  throw new Error("Nieprawidłowa data operacji PDF.");
 return v;
}
function previewStatementText(text){
 const lines=String(text||"").replace(/\r/g,"").split("\n").map(s=>s.trim()).filter(Boolean);
 if(lines.length>15000)throw new Error("PDF zawiera zbyt wiele wierszy do bezpiecznej analizy.");
 const openingLines=lines.filter(x=>/saldo początkowe\s*:/i.test(x));
 const closingLines=lines.filter(x=>/saldo końcowe\s*:/i.test(x));
 const accountMatches=[...new Set((text.match(/(?:PL\s*)?(?:\d[\s-]*){26}/g)||[])
   .map(x=>x.replace(/[\s-]/g,"")).filter(x=>/^(?:PL)?\d{26}$/.test(x)))];
 const statementMatches=[...new Set((text.match(/\b20\d{2}\s*\/\s*\d{3}\b/g)||[]).map(x=>x.replace(/\s/g,"")))];
 if(openingLines.length!==1||closingLines.length!==1||accountMatches.length!==1||statementMatches.length!==1)
  throw new Error("Nie można jednoznacznie rozpoznać rachunku, wyciągu lub sald. Wymagana ręczna weryfikacja.");
 const starts=openingLines[0].match(AMOUNT)||[],ends=closingLines[0].match(AMOUNT)||[];
 if(starts.length!==1||ends.length<1)
  throw new Error("Nie udało się jednoznacznie odczytać sald PDF.");
 const openingCents=parsePolishAmount(starts[0]),closingCents=parsePolishAmount(ends[ends.length-1]);
 const parsed=[];let previous=openingCents;let errors=[];
 for(const line of lines){
  const m=line.match(ROW);
  if(!m)continue;
  const [,position,day,month,year,tail]=m;
  const amounts=tail.match(AMOUNT)||[];
  if(amounts.length!==2){errors.push(`Wiersz ${position}: niejednoznaczna kwota lub saldo.`);continue;}
  try{
   const date=iso(day,month,year);
   const printed=Math.abs(parsePolishAmount(amounts[0]));
   const after=parsePolishAmount(amounts[1]);
   const delta=after-previous;
   if(!Number.isSafeInteger(delta)||printed===0||Math.abs(delta)!==printed)
    throw new Error("kwota operacji nie zgadza się ze zmianą salda");
   if(parsed.some(x=>x.position===Number(position)))throw new Error("powtórzony numer operacji");
   const description=tail.slice(0,tail.lastIndexOf(amounts[0])).trim();
   if(!description)throw new Error("brak opisu operacji");
   parsed.push({position:Number(position),date,amount:(delta/100).toFixed(2),
    balanceAfter:(after/100).toFixed(2),description:description.slice(0,1000)});
   previous=after;
  }catch(e){errors.push(`Wiersz ${position}: ${e.message}`);}
 }
 if(!parsed.length||errors.length||previous!==closingCents)
  throw new Error(errors[0]||"Brak operacji lub suma operacji nie zgadza się z saldem końcowym.");
 // The parser does not infer a statement period from transaction dates.
 return {iban:accountMatches[0].startsWith("PL")?accountMatches[0]:"PL"+accountMatches[0],
  statementNumber:statementMatches[0],openingBalance:(openingCents/100).toFixed(2),
  closingBalance:(closingCents/100).toFixed(2),
  transactionCount:parsed.length,transactions:parsed,
  requiresReview:true,canImportAutomatically:false};
}
module.exports={previewStatementText};
