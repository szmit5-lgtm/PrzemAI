"use strict";
const prisma=require("../../lib/prisma");
const {OrganizationError}=require("./OrganizationService");
const {OrganizationBankAccessService}=require("./OrganizationBankAccessService");

const MAX_TRANSACTIONS=50000;
const MAX_STATEMENTS=5000;
const ACCESS=new OrganizationBankAccessService();

function toCents(value){
 const s=String(value??"").trim();
 const match=/^(-?)(\d+)(?:\.(\d{1,2}))?$/.exec(s);
 if(!match)throw new Error("Niepoprawna wartość operacji lub salda bankowego.");
 const abs=BigInt(match[2])*100n+BigInt((match[3]||"").padEnd(2,"0")||"0");
 return match[1]==="-"?-abs:abs;
}
function money(value){
 const neg=value<0n,abs=neg?-value:value;
 return (neg?"-":"")+(abs/100n).toString()+"."+String(abs%100n).padStart(2,"0");
}
const iso=date=>new Date(date).toISOString().slice(0,10);
const startOfMonth=(year,month)=>new Date(Date.UTC(year,month-1,1));
const nextMonth=(year,month)=>new Date(Date.UTC(year,month,1));
const lastDay=(year,month)=>new Date(Date.UTC(year,month,0)).toISOString().slice(0,10);
const MONTHS=12;
function aggregateAccount(transactions,accountId,month){
 const values=transactions.filter(tx=>tx.bankAccountId===accountId&&
  new Date(tx.bookedAt).getUTCMonth()+1===month);
 let inflows=0n,outflows=0n;
 for(const row of values){
  const amount=toCents(row.amount);
  if(amount>=0n)inflows+=amount;
  else outflows-=amount;
 }
 return {inflows:money(inflows),outflows:money(outflows),
  net:money(inflows-outflows),transactionCount:values.length};
}
function counterpartiesForPeriod(transactions, accounts) {
 const currencies = new Map(accounts.map(account => [account.id, account.currency]));
 const groups = new Map();
 for (const transaction of transactions) {
  const currency = currencies.get(transaction.bankAccountId);
  if (!currency) continue;
  const counterparty = transaction.counterparty?.trim() || null;
  const key = JSON.stringify([currency, counterparty?.toLocaleLowerCase("pl-PL") || null]);
  const group = groups.get(key) || {currency, counterparty, inflows:0n, outflows:0n, count:0};
  const amount = toCents(transaction.amount);
  if (amount > 0n) group.inflows += amount;
  if (amount < 0n) group.outflows -= amount;
  group.count++;
  groups.set(key, group);
 }
 return [...groups.values()].map(({inflows,outflows,...group}) => ({
  ...group, inflows:money(inflows), outflows:money(outflows), net:money(inflows-outflows)
 }));
}

function totalsForCurrency(accountRows){
 const grouped=new Map();
 for(const row of accountRows){
  const key=row.currency;
  const total=grouped.get(key)||{currency:key,inflows:0n,outflows:0n,
   current:0n,vat:0n,other:0n,known:0,missing:0,accounts:0,transactions:0,
   currentCount:0,vatCount:0,otherCount:0,
   currentMissing:0,vatMissing:0,otherMissing:0};
  total.accounts++;
  total.transactions+=row.transactionCount;
  total.inflows+=toCents(row.inflows);
  total.outflows+=toCents(row.outflows);
  const group=row.accountType==="VAT"?"vat":row.accountType==="CURRENT"?"current":"other";
  total[group+"Count"]++;
  if(row.closingBalance===null){
   total.missing++;
   total[group+"Missing"]++;
  }else{
   total.known++;
   total[group]+=toCents(row.closingBalance);
  }
  grouped.set(key,total);
 }
 return [...grouped.values()].sort((a,b)=>a.currency.localeCompare(b.currency))
  .map(x=>({
   currency:x.currency,inflows:money(x.inflows),outflows:money(x.outflows),
   net:money(x.inflows-x.outflows),transactions:x.transactions,
   accounts:x.accounts,accountsWithConfirmedBalance:x.known,
   missingBalances:x.missing,
   // Do NOT fabricate month-end totals from a partial set of accounts.
   balance:x.missing===0?money(x.current+x.vat+x.other):null,
   currentBalance:x.currentCount>0&&x.currentMissing===0?money(x.current):null,
   vatBalance:x.vatCount>0&&x.vatMissing===0?money(x.vat):null,
   otherBalance:x.otherCount>0&&x.otherMissing===0?money(x.other):null
  }));
}

class OrganizationBankMonthlyService{
 constructor({db=prisma,access=ACCESS}={}){this.db=db;this.access=access;}
 async activity(userId,organizationId,yearInput,monthInput,options={}){
  await this.access.authorize(userId,organizationId);
  const year=Number(yearInput),month=Number(monthInput),offset=Number(options.offset??0);
  const {direction,currency}=options;
  if(!Number.isInteger(year)||year<2020||year>2100||!Number.isInteger(month)||month<1||month>12||
     !Number.isInteger(offset)||offset<0||offset>MAX_TRANSACTIONS||
     !["inflows","outflows"].includes(direction)||typeof currency!=="string"||!/^[A-Z]{3}$/.test(currency))
   throw new OrganizationError("Nieprawidłowy zakres operacji.",400);
  const rows=await this.db.bankTransaction.findMany({
   where:{organizationId,bankAccount:{organizationId,currency},
    bookedAt:{gte:startOfMonth(year,month),lt:nextMonth(year,month)},
    amount:direction==="inflows"?{gt:0}:{lt:0}},
   orderBy:[{bookedAt:"desc"},{id:"desc"}],skip:offset,take:51,
   select:{id:true,bookedAt:true,amount:true,description:true,counterparty:true,
    bankAccount:{select:{accountType:true}}}
  });
  return {items:rows.slice(0,50).map(({bankAccount,...row})=>({...row,amount:money(toCents(row.amount)),
   accountType:bankAccount.accountType})),hasMore:rows.length>50};
 }
 async report(userId,organizationId,yearInput){
  await this.access.authorize(userId,organizationId);
  const year=Number(yearInput);
  if(!Number.isInteger(year)||year<2020||year>2100)
   throw new OrganizationError("Wybierz poprawny rok zestawienia (2020–2100).",400);
  const accounts=await this.db.bankAccount.findMany({
   where:{organizationId},
   select:{id:true,iban:true,label:true,accountType:true,currency:true},
   orderBy:[{accountType:"asc"},{id:"asc"}],
   take:200
  });
  if(accounts.length===200)
   throw new OrganizationError("Zbyt wiele rachunków do wyświetlenia; skontaktuj się z administratorem.",413);
  const [statements,transactions]=await Promise.all([
   this.db.bankStatement.findMany({
    where:{organizationId,periodEnd:{lt:startOfMonth(year+1,1)}},
    select:{id:true,bankAccountId:true,periodEnd:true,closingBalance:true,
     sourceType:true,importedAt:true},
    orderBy:[{periodEnd:"asc"},{importedAt:"asc"}],
    take:MAX_STATEMENTS+1
   }),
   this.db.bankTransaction.findMany({
    where:{organizationId,bookedAt:{
     gte:startOfMonth(year,1),lt:startOfMonth(year+1,1)
    }},
    select:{id:true,bankAccountId:true,bookedAt:true,amount:true,counterparty:true},
    orderBy:[{bookedAt:"asc"},{id:"asc"}],
    take:MAX_TRANSACTIONS+1
   })
  ]);
  if(statements.length>MAX_STATEMENTS||transactions.length>MAX_TRANSACTIONS)
   throw new OrganizationError("Raport obejmuje zbyt wiele danych. Wybierz mniejszy zakres lub skontaktuj się z administratorem.",413);
  const months=[];
  for(let month=1;month<=MONTHS;month++){
   const monthEnd=lastDay(year,month),boundary=nextMonth(year,month);
   const accountRows=accounts.map(account=>{
    const transactionsForAccount=aggregateAccount(transactions,account.id,month);
    // The latest statement with an explicit balance is the source of truth.
    // A previous-month or mid-month balance is NOT an end-of-month balance.
    const confirmed=statements.filter(s=>
     s.bankAccountId===account.id&&s.closingBalance!=null&&
     new Date(s.periodEnd)<boundary).at(-1)||null;
    const confirmedAt=confirmed?iso(confirmed.periodEnd):null;
    const isMonthEnd=confirmedAt===monthEnd;
    return {
     accountId:account.id,ibanSuffix:account.iban.slice(-4),
     label:account.label||null,currency:account.currency,
     accountType:account.accountType,
     ...transactionsForAccount,
     closingBalance:isMonthEnd?String(confirmed.closingBalance):null,
     lastKnownBalance:confirmed?String(confirmed.closingBalance):null,
     lastKnownAt:confirmedAt,
     confirmedMonthEnd:isMonthEnd
    };
   });
   months.push({month,lastDay:monthEnd,accounts:accountRows,
    currencies:totalsForCurrency(accountRows),
    counterparties:counterpartiesForPeriod(transactions.filter(
     row=>new Date(row.bookedAt).getUTCMonth()+1===month),accounts)});
  }
  const quarters = Array.from({length:4}, (_, index) => {
   const first = index*3;
   const periodMonths = months.slice(first, first+3);
   const accountRows = periodMonths[2].accounts.map((closing, accountIndex) => {
    const rows = periodMonths.map(month => month.accounts[accountIndex]);
    const inflows = rows.reduce((total,row) => total+toCents(row.inflows),0n);
    const outflows = rows.reduce((total,row) => total+toCents(row.outflows),0n);
    return {...closing,inflows:money(inflows),outflows:money(outflows),
     net:money(inflows-outflows),transactionCount:rows.reduce((sum,row)=>sum+row.transactionCount,0)};
   });
   return {quarter:index+1,lastDay:periodMonths[2].lastDay,accounts:accountRows,
    currencies:totalsForCurrency(accountRows),
    counterparties:counterpartiesForPeriod(transactions.filter(row =>
     Math.floor(new Date(row.bookedAt).getUTCMonth()/3)===index),accounts)};
  });
  return {organizationId,year,source:"IMPORTED_BANK_STATEMENTS",
   accounts:accounts.map(a=>({id:a.id,ibanSuffix:a.iban.slice(-4),
    label:a.label||null,accountType:a.accountType,currency:a.currency})),
   months,quarters};
 }
}
module.exports={OrganizationBankMonthlyService,toCents,money,aggregateAccount,totalsForCurrency};
