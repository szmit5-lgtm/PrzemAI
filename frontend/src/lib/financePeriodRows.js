// Pure aggregation for company KSeF reports. Amounts are grouped by
// currency AND direction; gross invoice totals are not a cash-flow balance.
function cents(value) {
  const match=/^(-?)(\d+)(?:\.(\d{1,2}))?$/.exec(String(value??"").trim());
  if(!match)return null;
  const magnitude=BigInt(match[2])*100n+BigInt((match[3]||"").padEnd(2,"0")||"0");
  return match[1]==="-"?-magnitude:magnitude;
}

export function groupKsefPeriods(rows,{quarterly=false}={}) {
  if(!Array.isArray(rows))return [];
  const totals=new Map();
  for(const row of rows) {
    const month=Number(row?.month),count=Number(row?.count);
    const currency=String(row?.currency||"").toUpperCase();
    const direction=String(row?.direction||"");
    const gross=cents(row?.gross);
    if(!Number.isInteger(month)||month<1||month>12 ||
      !Number.isInteger(count)||count<0||gross===null||
      !/^[A-Z]{3}$/.test(currency)||!["INCOMING","OUTGOING"].includes(direction))continue;
    const period=quarterly?Math.ceil(month/3):month;
    const key=period+"|"+direction+"|"+currency;
    const previous=totals.get(key)||{period,direction,currency,count:0,grossCents:0n};
    previous.count+=count;
    previous.grossCents+=gross;
    totals.set(key,previous);
  }
  return [...totals.values()].sort((a,b)=>a.period-b.period||
    a.currency.localeCompare(b.currency)||a.direction.localeCompare(b.direction));
}
export function formatKsefCents(amount,currency) {
  if(typeof amount!=="bigint")return "—";
  if(amount<=BigInt(Number.MAX_SAFE_INTEGER)&&amount>=-BigInt(Number.MAX_SAFE_INTEGER)){
    try{return new Intl.NumberFormat("pl-PL",{style:"currency",currency}).format(Number(amount)/100);}
    catch{return (Number(amount)/100).toFixed(2)+" "+currency;}
  }
  const negative=amount<0n;
  const absolute=negative?-amount:amount;
  const whole=absolute/100n;
  const rest=String(absolute%100n).padStart(2,"0");
  return (negative?"-":"")+new Intl.NumberFormat("pl-PL").format(whole)+","+rest+" "+currency;
}
