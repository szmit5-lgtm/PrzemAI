"use strict";

// No AI guesses and no paid external OCR: import only transactions for which
// the source file supplies recognizable dates and exact amounts.
const HEADER = {
  date:["date","bookingdate","transactiondate","data","dataksiegowania","dataoperacji","datatransakcji","datawykonania","datyksiegowania"],
  amount:["amount","kwota","kwotaoperacji","kwotatransakcji","wartosc","wartoscoperacji","kwotawwalucierachunku","kwotapln"],
  debit:["debit","obciazenie","obciazenia","wydatek","wydatki","rozchod","kwotaw","kwotawpln"],
  credit:["credit","uznanie","uznania","wplyw","wplywy","przychod","kwotama","kwotamapln"],
  description:["description","opis","opisoperacji","opistransakcji","tytul","tytuloperacji","tytulplatnosci","tytulem","szczegolytransakcji","tresctransakcji","operacja"],
  counterparty:["counterparty","kontrahent","nazwakontrahenta","daneodbiorcy","odbiorca","nadawca","beneficjent","nazwaodbiorcy"],
  reference:["reference","referencja","numerreferencyjny","numertransakcji","idtransakcji","identyfikatortransakcji"],
  currency:["currency","waluta","walutarachunku","walutaoperacji"],
  account:["rachunekwlasny","numerrachunkuwlasnego","rachunekfirmowy","numerrachunkufirmy","ibanfirmy"],
  balance:["balance","saldopooperacji","saldopo","saldokoncowe"]
};
const FOLD = {"ą":"a","ć":"c","ę":"e","ł":"l","ń":"n","ó":"o","ś":"s","ź":"z","ż":"z"};
function label(value){
  return String(value||"").toLowerCase().replace(/[ąćęłńóśźż]/g,c=>FOLD[c]).replace(/[^a-z0-9]/g,"");
}
function normalizeDate(value){
 const s=String(value||"").trim();
 let m=/^(\d{4})[-./](\d{1,2})[-./](\d{1,2})$/.exec(s);
 if(!m){
  const p=/^(\d{1,2})[-./](\d{1,2})[-./](\d{4})$/.exec(s);
  if(p)m=[p[0],p[3],p[2],p[1]];
 }
 if(!m)return null;
 const iso=m[1].padStart(4,"0")+"-"+m[2].padStart(2,"0")+"-"+m[3].padStart(2,"0");
 const d=new Date(iso+"T12:00:00.000Z");
 return !Number.isNaN(d.getTime())&&d.toISOString().slice(0,10)===iso?iso:null;
}
function parseAmount(value){
 const raw=String(value??"").trim().replace(/\u00a0/g," ").replace(/\u2212/g,"-")
   .replace(/\s*(?:PLN|EUR|USD)\s*$/i,"").replace(/\s/g,"");
 if(!raw)return null;
 let s=raw;
 if(/^\(.*\)$/.test(s))s="-"+s.slice(1,-1);
 if(s.includes(",")&&s.includes(".")){
  const comma=s.lastIndexOf(","),dot=s.lastIndexOf(".");
  s=comma>dot?s.replace(/\./g,"").replace(",","."):s.replace(/,/g,"");
 }else if(s.includes(",")){
  s=s.replace(",",".");
 }
 if(!/^-?\d{1,16}(?:\.\d{1,2})?$/.test(s))return null;
 const negative=s.startsWith("-");
 const [whole,fraction=""]=s.replace("-","").split(".");
 const cents=BigInt(whole)*100n+BigInt(fraction.padEnd(2,"0"));
 if(cents>999999999999999999n)return null;
 const amount=(negative?"-":"")+whole+"."+fraction.padEnd(2,"0");
 return { amount, cents:negative?-cents:cents };
}
function iban(value) {
 const v=String(value||"").toUpperCase().replace(/[\s-]/g,"");
 const full=/^\d{26}$/.test(v)?"PL"+v:v;
 if(!/^PL\d{26}$/.test(full))return null;
 // ISO 13616 MOD-97 checksum for Polish bank accounts.
 const rearranged=full.slice(4)+("P".charCodeAt(0)-55)+("L".charCodeAt(0)-55)+full.slice(2,4);
 let rest=0;
 for(const digit of rearranged)rest=(rest*10+Number(digit))%97;
 return rest===1?full:null;
}
function parseDelimited(text,delimiter) {
 const rows=[];let row=[],cell="",quoted=false;
 for(let i=0;i<text.length;i++){
  const ch=text[i];
  if(ch==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;}
  else if(ch===delimiter&&!quoted){row.push(cell.trim());cell="";}
  else if((ch==="\n"||ch==="\r")&&!quoted){
   if(ch==="\r"&&text[i+1]==="\n")i++;
   row.push(cell.trim());if(row.some(Boolean))rows.push(row);
   row=[];cell="";
  }else cell+=ch;
 }
 if(quoted)throw Error("Niekompletne pola CSV w cudzysłowach.");
 row.push(cell.trim());if(row.some(Boolean))rows.push(row);
 return rows;
}
function findColumns(row){
 const cells=row.map(label);
 const indexFor=kind=>cells.findIndex(cell=>HEADER[kind].includes(cell));
 return {
  date:indexFor("date"),amount:indexFor("amount"),debit:indexFor("debit"),
  credit:indexFor("credit"),description:indexFor("description"),
  counterparty:indexFor("counterparty"),reference:indexFor("reference"),
  currency:indexFor("currency"),account:indexFor("account")
 };
}
function labelledValue(rows,types){
 const pattern=new RegExp("^(?:"+types.join("|")+")$");
 for(const row of rows){
  for(let i=0;i<row.length;i++){
   const raw=String(row[i]||"");
   const colon=/^([^:]+):\s*(.+)$/.exec(raw);
   if(colon&&pattern.test(label(colon[1])))return colon[2].trim();
   if(pattern.test(label(raw))&&String(row[i+1]||"").trim())return String(row[i+1]).trim();
  }
 }
 return null;
}
function decodeCsv(buffer){
 const bom=buffer.subarray(0,3).equals(Buffer.from([0xef,0xbb,0xbf]));
 const source=bom?buffer.subarray(3):buffer;
 try{return new TextDecoder("utf-8",{fatal:true}).decode(source);}
 catch{return new TextDecoder("windows-1250",{fatal:true}).decode(source);}
}
function parseErsteHistory(text){
 const rows=parseDelimited(text,",");
 const expected=["nadawca","rachuneknadawcy","odbiorca","rachunekodbiorcy","tytul","kwota","waluta","zaksiegowano","saldopooperacji"];
 if(JSON.stringify(rows[0]?.map(label))!==JSON.stringify(expected))return null;
 if(rows.length<2||rows.length>10001)throw Error("Nieprawidłowa liczba operacji.");
 const groups=new Map();
 for(const row of rows.slice(1)){
  const amount=parseAmount(row[5]),balance=parseAmount(row[8]),date=normalizeDate(row[7]);
  if(row.length!==9||!amount||!balance||!date||amount.cents===0n||row[6]!=="PLN")throw Error("Nieprawidłowa operacja historii Erste.");
  const outgoing=amount.cents<0n,account=iban(row[outgoing?1:3]);
  if(!account)throw Error("Nieprawidłowy rachunek własny historii Erste.");
  if(!groups.has(account))groups.set(account,[]);
  groups.get(account).push({date,amount:amount.amount,balanceAfter:balance.amount,description:row[4].slice(0,1000),counterparty:row[outgoing?2:0].slice(0,250),reference:""});
 }
 const accounts=[];
 for(const [account,rows] of groups){
  const valid=rs=>rs.every((r,i)=>!i||(r.date>=rs[i-1].date&&parseAmount(rs[i-1].balanceAfter).cents+parseAmount(r.amount).cents===parseAmount(r.balanceAfter).cents));
  const transactions=valid(rows)?rows:valid([...rows].reverse())?[...rows].reverse():null;
  if(!transactions)throw Error("Brak ciągłości salda historii Erste.");
  const first=transactions[0],last=transactions[transactions.length-1];
  const cents=parseAmount(first.balanceAfter).cents-parseAmount(first.amount).cents;
  const abs=cents<0n?-cents:cents;
  const openingBalance=(cents<0n?"-":"")+(abs/100n)+"."+String(abs%100n).padStart(2,"0");
  const hash=require("node:crypto").createHash("sha256").update(JSON.stringify(transactions)).digest("hex").slice(0,24);
  accounts.push({account,currency:"PLN",sourceType:"CSV_EXPORT",statementNumber:"CSV_HISTORY_"+hash,transactions,openingBalance,closingBalance:last.balanceAfter,periodStart:first.date,periodEnd:last.date,balanceIssue:false});
 }
 return {accounts,extractedCount:rows.length-1,balanceIssue:false};
}
function parseBankCsv(buffer) {
 // Erste iBiznes24's printed-statement CSV is structurally different from
 // ordinary bank transaction exports and can carry several accounts.
 const {isErstePrintedCsv,parseErstePrintedCsv}=require("./ErsteStatementCsvParser");
 if(isErstePrintedCsv(buffer))return parseErstePrintedCsv(buffer);
 const text=decodeCsv(buffer);
 const history=parseErsteHistory(text);
 if(history)return history;
 if(text.includes("\0"))throw Error("CSV zawiera niepoprawne dane binarne.");
 let best=null;
 for(const delimiter of [";","\t",","]){
  const rows=parseDelimited(text,delimiter);
  for(let i=0;i<Math.min(rows.length,40);i++){
   const cols=findColumns(rows[i]);
   const hasAmount=cols.amount>=0||(cols.debit>=0&&cols.credit>=0);
   if(cols.date>=0&&hasAmount&&cols.description>=0&&rows.length-i>=2){
    const score=Object.values(cols).filter(v=>v>=0).length;
    if(!best||score>best.score)best={rows,cols,i,score,delimiter};
   }
  }
 }
 if(!best)throw Error("Nie rozpoznano kolumn dat, kwot i opisów transakcji w CSV.");
 const {rows,cols,i}=best;
 const body=rows.slice(i+1);
 if(body.length>30000)throw Error("CSV zawiera zbyt wiele wierszy.");
 const transactions=[];const seenIban=new Set(),seenCurrency=new Set();
 let currencyFromAmount=false;
 for(const [offset,raw] of body.entries()){
  if(raw.every(v=>!String(v).trim()))continue;
  const date=normalizeDate(raw[cols.date]);
  const get=index=>index>=0?String(raw[index]||"").trim():"";
  const description=get(cols.description)||"Operacja bankowa";
  const amountSource=get(cols.amount);
  const debit=get(cols.debit),credit=get(cols.credit);
  const hasSum=amountSource||debit||credit;
  if(!date){
   // Ignore explicit footer totals only; never silently drop a transaction.
   if(/^(suma|razem|saldo|podsumowanie|ilosc|liczba|total)/i.test(label(raw.join(" "))))continue;
   throw Error("Nie odczytano daty operacji w wierszu "+(i+offset+2)+".");
  }
  let amount;
  if(cols.amount>=0){amount=parseAmount(amountSource);}
  else {
   const d=debit?parseAmount(debit):null,c=credit?parseAmount(credit):null;
   if((d&&c)||(!d&&!c))throw Error("Nie można jednoznacznie odczytać obciążenia i uznania.");
   amount=d?{amount:(-((d.cents<0n?-d.cents:d.cents))/100n).toString(),cents:-((d.cents<0n?-d.cents:d.cents))}:c;
   if(d){
     const debitCents=d.cents<0n?-d.cents:d.cents;
     amount={amount:"-"+(debitCents/100n).toString()+"."+String(debitCents%100n).padStart(2,"0"),cents:-debitCents};
   }
  }
  if(!amount||!hasSum)throw Error("Nie można jednoznacznie odczytać kwoty w wierszu "+(i+offset+2)+".");
  const inlineCurrency=/\b(PLN|EUR|USD)\b/i.exec(amountSource);
  if(inlineCurrency){seenCurrency.add(inlineCurrency[1].toUpperCase());currencyFromAmount=true;}
  if(cols.currency>=0){const cur=get(cols.currency).toUpperCase();if(cur)seenCurrency.add(cur);}
  if(cols.account>=0){
   const rawIban=get(cols.account);
   if(rawIban){const candidate=iban(rawIban);if(!candidate)throw Error("Nieprawidłowy numer rachunku firmowego w CSV.");seenIban.add(candidate);}
  }
  transactions.push({date,amount:amount.amount,description:description.slice(0,1000),
    counterparty:get(cols.counterparty).slice(0,250),reference:get(cols.reference).slice(0,250)});
 }
 if(!transactions.length)throw Error("Plik CSV nie zawiera operacji.");
 if(transactions.length>10000)throw Error("Jednorazowy import jest ograniczony do 10000 transakcji.");
 if(seenIban.size>1)throw Error("CSV zawiera więcej niż jeden rachunek firmowy.");
 if(seenCurrency.size>1)throw Error("CSV zawiera transakcje w różnych walutach.");
 const preamble=rows.slice(0,i);
 const accountFromPreamble=labelledValue(preamble,[
  "numerrachunku","numerrachunkubankowego","numerrachunkufirmy","rachunekwlasny","ibanfirmy","ibannumer","iban","rachunek"
 ]);
 const account=seenIban.size?[...seenIban][0]:iban(accountFromPreamble);
 if(accountFromPreamble&&!iban(accountFromPreamble))throw Error("Nieprawidłowy IBAN w nagłówku wyciągu.");
 const explicitCurrency=labelledValue(preamble,["waluta","walutarachunku","currency"]);
 if(explicitCurrency)seenCurrency.add(explicitCurrency.toUpperCase());
 const headerCurrency=/\b(PLN|EUR|USD)\b/i.exec(rows[i].join(" "));
 if(headerCurrency)seenCurrency.add(headerCurrency[1].toUpperCase());
 const currency=seenCurrency.size===1?[...seenCurrency][0]:null;
 const openingRaw=labelledValue(preamble,["saldopoczatkowe","saldootwarcia","saldozpoprzedniegookresu"]);
 const closingRaw=labelledValue([...preamble,...rows.slice(-6)],["saldokoncowe","saldokoncowewyciagu","saldopooperacjach"]);
 const opening=openingRaw==null?null:parseAmount(openingRaw);
 const closing=closingRaw==null?null:parseAmount(closingRaw);
 const dates=transactions.map(r=>r.date).sort();
 const periodStart=dates[0],periodEnd=dates[dates.length-1];
 // Never mark a statement as reconciled unless the source provides BOTH
 // balances and their arithmetic matches every extracted row.
 const sum=transactions.reduce((v,t)=>v+parseAmount(t.amount).cents,0n);
 const balanceIssue=(openingRaw!=null||closingRaw!=null)&&
  (!opening||!closing||opening.cents+sum!==closing.cents);
 const number=labelledValue(preamble,["numerwyciagu","nrwyciagu","wyciagnr","nrwyciagubankowego"]);
 return {transactions,account,currency,periodStart,periodEnd,
  statementNumber:number,openingBalance:opening?.amount??null,
  closingBalance:closing?.amount??null,balanceIssue,
  extractedCount:transactions.length};
}
module.exports={parseBankCsv,normalizeDate,parseAmount,iban};
