"use client";
import {useEffect,useMemo,useState} from "react";
import Link from "next/link";
import {ArrowUpRight,Landmark,Wallet,ShieldCheck,RefreshCw} from "lucide-react";
import {getOrganizationBankSummary} from "@/lib/api";

const cents=value=>{
 const match=/^(-?)(\d+)(?:\.(\d{1,2}))?$/.exec(String(value??"").trim());
 if(!match)return null;
 const result=BigInt(match[2])*100n+BigInt((match[3]||"").padEnd(2,"0")||"0");
 return match[1]==="-"?-result:result;
};
const showMoney=value=>{
 if(value===null)return "—";
 const negative=value<0n,amount=negative?-value:value;
 return (negative?"−":"")+new Intl.NumberFormat("pl-PL").format(amount/100n)+","+
  String(amount%100n).padStart(2,"0")+" zł";
};
function summarize(accounts,kind){
 const selected=accounts.filter(x=>x.accountType===kind&&x.currency==="PLN");
 if(!selected.length)return {amount:null,date:null,accounts:0};
 const timestamps=selected.map(x=>x.balanceDate&&String(x.balanceDate).slice(0,10));
 const values=selected.map(x=>cents(x.balance));
 if(values.some(x=>x===null)||timestamps.some(x=>!x)||new Set(timestamps).size!==1)
  return {amount:null,date:null,accounts:selected.length};
 return {amount:values.reduce((a,b)=>a+b,0n),date:timestamps[0],accounts:selected.length};
}
function formatDate(date){if(!date)return null;const [y,m,d]=date.split("-");return d+"."+m+"."+y;}
export default function CompanyBankSnapshot({company,refreshKey=0}){
 const [items,setItems]=useState([]);
 const [loading,setLoading]=useState(false);
 const [error,setError]=useState("");
 const [localRefresh,setLocalRefresh]=useState(0);
 const id=company?.id||null;
 useEffect(()=>{
  if(!id){setItems([]);setError("");setLoading(false);return;}
  let active=true;setItems([]);setError("");setLoading(true);
  getOrganizationBankSummary(id).then(result=>{
   if(!active)return;
   if(!Array.isArray(result?.data?.accounts))throw Error("Nie można potwierdzić danych bankowych spółki.");
   setItems(result.data.accounts);
  }).catch(err=>{if(active)setError(err?.status===403?
   "Brak uprawnień do finansów tej spółki.":"Nie udało się pobrać sald: "+(err?.message||"błąd serwera"));})
   .finally(()=>{if(active)setLoading(false);});
  return()=>{active=false;};
 },[id,refreshKey,localRefresh]);
 const current=useMemo(()=>summarize(items,"CURRENT"),[items]);
 const vat=useMemo(()=>summarize(items,"VAT"),[items]);
 const plnAccounts=items.filter(x=>x.currency==="PLN");
 const total=useMemo(()=>{
  if(!plnAccounts.length)return null;
  const days=plnAccounts.map(x=>x.balanceDate&&String(x.balanceDate).slice(0,10));
  const balances=plnAccounts.map(x=>cents(x.balance));
  if(balances.some(x=>x===null)||days.some(x=>!x)||new Set(days).size!==1)return null;
  return {amount:balances.reduce((a,b)=>a+b,0n),date:days[0]};
 },[items]);
 if(!company)return <section aria-label="Stan rachunków bankowych" className="mt-4 rounded-2xl border border-cyan-400/25 bg-[#101d33] p-4">
  <p className="flex items-center gap-2 text-base font-bold"><Landmark size={20} className="text-cyan-300"/> Pieniądze na kontach firmowych</p>
  <p className="mt-2 text-sm text-slate-300">Wybierz u góry Dekonica lub Deherus, aby zobaczyć aktualnie zaimportowane salda tej spółki.</p>
 </section>;
 return <section aria-label={"Stan rachunków — "+(company.displayName||company.name)}
  className="mt-4 rounded-2xl border border-cyan-400/25 bg-gradient-to-r from-[#11253c] to-[#171d38] p-4 sm:p-5">
  <div className="flex flex-wrap items-center justify-between gap-3">
   <div>
    <p className="flex items-center gap-2 text-base font-bold sm:text-lg"><Landmark size={20} className="text-cyan-300"/>
     Stan banków — {company.displayName||company.name}
    </p>
    <p className="mt-1 text-xs text-slate-400">Ostatnie potwierdzone salda z wyciągów, nie połączenie bankowe na żywo.</p>
   </div>
   <div className="flex flex-wrap items-center gap-2">
    <button type="button" onClick={()=>setLocalRefresh(n=>n+1)} disabled={loading}
     className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-white/15 px-3 text-xs font-semibold text-slate-200 disabled:opacity-50">
     <RefreshCw size={15} className={loading?"animate-spin":""}/> Odśwież
    </button>
    <Link href={"/company/"+encodeURIComponent(id)+"/bank/reports"}
     className="inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-cyan-500/15 px-3 text-xs font-semibold text-cyan-100">
     Zestawienia <ArrowUpRight size={15}/>
    </Link>
   </div>
  </div>
  {loading?<p role="status" className="mt-4 text-sm text-slate-300">Pobieram salda spółki…</p>:
   error?<p role="status" className="mt-4 text-sm text-amber-200">{error}</p>:
   !items.length?<p className="mt-4 text-sm text-slate-300">Nie ma jeszcze zaimportowanych rachunków tej spółki.</p>:
   <>
    <div className="mt-4 grid gap-3 sm:grid-cols-3">
     {[
      {name:"Rachunek bieżący",value:current,icon:Wallet,desc:"Środki na rachunku firmowym"},
      {name:"Rachunek VAT",value:vat,icon:Landmark,desc:"Środki z ograniczeniami wykorzystania"},
      {name:"Łącznie na rachunkach PLN",value:total||{amount:null,date:null},icon:ShieldCheck,desc:"Tylko salda potwierdzone na ten sam dzień"}
     ].map(card=><div key={card.name} className="rounded-xl border border-white/10 bg-[#0a172d] p-3">
      <p className="text-xs font-semibold text-slate-300">{card.name}</p>
      <p className="mt-2 break-words text-xl font-black tabular-nums text-white sm:text-2xl">{showMoney(card.value.amount)}</p>
      <p className="mt-1 text-[11px] leading-4 text-slate-400">
       {card.value.date?"Stan z "+formatDate(card.value.date):"Brak wspólnej daty lub potwierdzonego salda"}
      </p>
      <p className="mt-2 text-[11px] leading-4 text-slate-500">{card.desc}</p>
     </div>)}
    </div>
    {items.some(x=>x.balance!=null)&&<p className="mt-3 text-xs leading-5 text-slate-400">
     Szczegóły: {items.map(x=>((x.accountType==="VAT"?"VAT":"Bieżący")+
      " ••••"+x.ibanSuffix+": "+(cents(x.balance)===null?"brak salda":showMoney(cents(x.balance)))+
      (x.balanceDate?" ("+formatDate(String(x.balanceDate).slice(0,10))+")":""))).join(" · ")}
    </p>}
   </>}
 </section>;
}
