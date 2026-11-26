"use strict";
const {TextDecoder}=require("node:util");

// Erste iBiznes24 "CSV wyciąg": a semicolon export of a PRINTED statement,
// not a typical date;amount;description table. One upload can contain
// several independent current/VAT accounts. Never mix their transactions.
const token=value=>String(value||"").trim();
function normalizeDate(raw){
 const value=token(raw);
 const match=/^(\d{2})-(\d{2})-(\d{4})$/.exec(value);
 if(!match)return null;
 const iso=match[3]+"-"+match[2]+"-"+match[1];
 const date=new Date(iso+"T12:00:00Z");
 return !Number.isNaN(date.getTime())&&date.toISOString().slice(0,10)===iso?iso:null;
}
function amountCents(raw){
 let value=token(raw).replace(/[\s\u00a0\u202f]/g,"").replace(/\u2212/g,"-");
 if(!/^-?\d{1,15},\d{2}$/.test(value))return null;
 const negative=value.startsWith("-");
 if(negative)value=value.slice(1);
 const [whole,fraction]=value.split(",");
 const cents=BigInt(whole)*100n+BigInt(fraction);
 return negative?-cents:cents;
}
function exactMoney(cents){
 const neg=cents<0n;
 const abs=neg?-cents:cents;
 return (neg?"-":"")+(abs/100n).toString()+"."+(abs%100n).toString().padStart(2,"0");
}
function validatedPolishIban(raw){
 const compact=token(raw).replace(/[\s-]/g,"");
 if(!/^\d{26}$/.test(compact))return null;
 const rearranged=compact.slice(2)+"2521"+compact.slice(0,2);
 let mod=0;
 for(const ch of rearranged)mod=(mod*10+Number(ch))%97;
 return mod===1?"PL"+compact:null;
}
function rowsFromCsv(text){
 const rows=[];let row=[],cell="",quote=false;
 for(let index=0;index<text.length;index++){
  const c=text[index];
  if(c==='"'){if(quote&&text[index+1]==='"'){cell+='"';index++;}else quote=!quote;}
  else if(c===";"&&!quote){row.push(cell.trim());cell="";}
  else if((c==="\n"||c==="\r")&&!quote){
   if(c==="\r"&&text[index+1]==="\n")index++;
   row.push(cell.trim());if(row.some(x=>x!==""))rows.push(row);
   row=[];cell="";
  }else cell+=c;
 }
 if(quote)throw Error("Nieprawidłowe cudzysłowy w eksporcie bankowym.");
 row.push(cell.trim());if(row.some(x=>x!==""))rows.push(row);
 return rows;
}
function decode(buffer){
 const bytes=buffer.subarray(0,3).equals(Buffer.from([0xef,0xbb,0xbf]))?buffer.subarray(3):buffer;
 try{return new TextDecoder("utf-8",{fatal:true}).decode(bytes);}
 catch{return new TextDecoder("windows-1250",{fatal:true}).decode(bytes);}
}
function isErstePrintedCsv(buffer){
 const start=decode(buffer).slice(0,64000);
 return start.includes("WYCIĄG Z RACHUNKU BANKOWEGO")&&
   start.includes("NR WYCIĄGU")&&start.includes("OBCIĄŻENIA");
}
function parseErstePrintedCsv(buffer){
 const content=decode(buffer);
 if(content.includes("\0"))throw Error("Plik CSV zawiera dane binarne.");
 const rows=rowsFromCsv(content);
 if(!rows.length||rows.length>40000)throw Error("Nieprawidłowy rozmiar eksportu bankowego.");
 const groups=new Map();
 let group=null;
 for(let index=0;index<rows.length;index++){
  const row=rows[index];
  if(row.some(x=>token(x)==="WYCIĄG Z RACHUNKU BANKOWEGO")){
   const accountLine=rows[index+1]||[];
   const raw=accountLine.map(token).find(x=>/^\d{2}(?:\s+\d{4}){6}$/.test(x));
   const account=validatedPolishIban(raw);
   if(!account)throw Error("Nie udało się bezpiecznie ustalić rachunku wyciągu.");
   const meta=rows[index-2]||[];
   const dates=meta.map(normalizeDate).filter(Boolean);
   const number=meta.map(token).find(x=>/^\d{4}\/\d{3,5}$/.test(x));
   if(dates.length!==3||!number||dates[1]>dates[2])
    throw Error("Nie udało się odczytać dat lub numeru wyciągu bankowego.");
   // Annual exports may contain several DIFFERENT monthly statements of
   // the SAME account, as well as the VAT account. Group by statement period,
   // not merely by IBAN. Identical repeated page headers reuse the group.
   const key=account+"|"+number+"|"+dates[1]+"|"+dates[2];
   if(groups.has(key))group=groups.get(key);
   else{
    group={account,statementNumber:number,periodStart:dates[1],periodEnd:dates[2],
     currency:null,accountType:null,expectedCount:null,openingBalance:null,
     closingBalance:null,transactions:[],lastBalance:null};
    groups.set(key,group);
   }
   continue;
  }
  if(!group)continue;
  const first=token(row[0]);
  if(first==="INFORMACJE DODATKOWE")continue;
  if((row.length===20||row.length===13)&&row.some(x=>/^Rachunek (bieżący|VAT)$/.test(token(x)))){
   const type=row.map(token).find(x=>/^Rachunek (bieżący|VAT)$/.test(x));
   const cur=row.map(token).find(x=>/^(PLN|EUR|USD)$/.test(x));
   const numeric=row.map(token).find(x=>/^\d{1,4}$/.test(x));
   if(!cur||!numeric)throw Error("Brak waluty lub liczby pozycji wyciągu.");
   if(group.currency&&group.currency!==cur)throw Error("Sprzeczna waluta rachunku.");
   group.currency=cur;
   group.accountType=type==="Rachunek VAT"?"VAT":"CURRENT";
   group.expectedCount=Number(numeric);
   continue;
  }
  const descriptionIndex=row.length===20?4:2;
  const balanceIndex=row.length===20?16:10;
  if(row.some(x=>token(x).startsWith("Saldo początkowe:"))){
   const opening=amountCents(row[balanceIndex]);
   if(opening===null)throw Error("Nie odczytano salda początkowego.");
   if(group.openingBalance!==null&&group.openingBalance!==opening)
    throw Error("Sprzeczne saldo początkowe.");
   group.openingBalance=opening;
   group.lastBalance=opening;
   continue;
  }
  if(row.some(x=>token(x).startsWith("Saldo końcowe:"))){
   const ending=amountCents(row[balanceIndex]);
   if(ending===null)throw Error("Nie odczytano salda końcowego.");
   group.closingBalance=ending;
   continue;
  }
  if(!/^\d{1,4}$/.test(first))continue;
  const idx=row.length===20?
   {date:2,description:4,debit:8,credit:12,balance:16}:
   {date:1,description:2,debit:4,credit:6,balance:10};
  const date=normalizeDate(row[idx.date]);
  if(!date||date<group.periodStart||date>group.periodEnd)
   throw Error("Nieprawidłowa data operacji w wyciągu.");
  const desc=token(row[idx.description]);
  if(!desc)throw Error("Brak opisu transakcji bankowej.");
  const debitText=token(row[idx.debit]),creditText=token(row[idx.credit]);
  if(Boolean(debitText)===Boolean(creditText))
   throw Error("Każda operacja musi mieć dokładnie jedno obciążenie albo uznanie.");
  const debit=debitText?amountCents(debitText):null;
  const credit=creditText?amountCents(creditText):null;
  const value=debit===null?credit:-debit;
  const balance=amountCents(row[idx.balance]);
  if(value===null||balance===null||value===0n)
   throw Error("Nieprawidłowa kwota lub saldo operacji bankowej.");
  if(Number(first)!==group.transactions.length+1)
   throw Error("Numeracja pozycji bankowych nie jest kompletna.");
  if(group.lastBalance===null||group.lastBalance+value!==balance)
   throw Error("Sald narastających nie można uzgodnić — import zablokowany.");
  group.lastBalance=balance;
  group.transactions.push({
   date,amount:exactMoney(value),description:desc.slice(0,1000),
   counterparty:"",reference:group.statementNumber+"/"+first,
   balanceAfter:exactMoney(balance)
  });
 }
 if(!groups.size)throw Error("Nie znaleziono rachunków w eksporcie Erste.");
 let total=0;
 const accounts=[];
 for(const group of groups.values()){
  if(!group.currency||!group.accountType||group.expectedCount===null||
   group.transactions.length!==group.expectedCount||
   group.openingBalance===null||group.closingBalance===null||
   group.lastBalance!==group.closingBalance)
   throw Error("Wyciąg nie zawiera wszystkich pozycji lub zgodnych sald rachunku.");
  const sum=group.transactions.reduce((a,row)=>a+BigInt(row.amount.replace(".","")),0n);
  if(group.openingBalance+sum!==group.closingBalance)
   throw Error("Suma obciążeń i uznań nie zgadza się z saldem końcowym.");
  total+=group.transactions.length;
  accounts.push({
   account:group.account,currency:group.currency,accountType:group.accountType,
   statementNumber:group.statementNumber,periodStart:group.periodStart,
   periodEnd:group.periodEnd,openingBalance:exactMoney(group.openingBalance),
   closingBalance:exactMoney(group.closingBalance),
   extractedCount:group.transactions.length,transactions:group.transactions,
   balanceIssue:false
  });
 }
 if(total>10000)throw Error("Eksport zawiera zbyt wiele transakcji (limit 10 000).");
 return {accounts,extractedCount:total,format:"ERSTE_PRINTED_CSV"};
}
module.exports={isErstePrintedCsv,parseErstePrintedCsv};
