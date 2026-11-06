"use client";
import {useEffect,useMemo,useState} from "react";
import Link from "next/link";
import {ArrowLeft,RefreshCw,ChartNoAxesColumn,Info} from "lucide-react";
import Navbar from "../../components/Navbar";
import UserMenu from "../../components/UserMenu";
import {getFinancePeriodReport} from "@/lib/api";
const CATEGORY_LABELS={
  FLEET:"Samochody i flota",RENT:"Czynsz i lokale",UTILITIES:"Media i energia",
  PAYROLL:"Wynagrodzenia",SOFTWARE:"Oprogramowanie",MATERIALS:"Materiały budowlane",
  SUBCONTRACTORS:"Podwykonawcy",LOGISTICS:"Transport i logistyka",
  TAXES:"Podatki i opłaty",GENERAL:"Koszty ogólne",OTHER:"Pozostałe"
};
const MONTHS=["Styczeń","Luty","Marzec","Kwiecień","Maj","Czerwiec",
  "Lipiec","Sierpień","Wrzesień","Październik","Listopad","Grudzień"];
const currencies=["PLN","EUR","USD","GBP"];
const money=(n,cur)=>new Intl.NumberFormat("pl-PL",{style:"currency",currency:cur,maximumFractionDigits:2}).format(n);
const total=(rows,period,num,cur,group,filter=()=>true)=>rows.filter(row=>
  row.period===period&&row.number===num&&row.currency===cur&&
  row.group===group&&filter(row)
).reduce((acc,row)=>acc+Number(row.gross||0),0);
export default function FinanceReports(){
 const [year,setYear]=useState(new Date().getFullYear());
 const [data,setData]=useState(null),[error,setError]=useState(""),[loading,setLoading]=useState(true);
 const [refresh,setRefresh]=useState(0);
 useEffect(()=>{
  let active=true;setLoading(true);setError("");
  getFinancePeriodReport(year).then(r=>{if(active)setData(r.data||null);})
    .catch(e=>{if(active){setData(null);setError(e.message||"Nie udało się pobrać raportu.");}})
    .finally(()=>{if(active)setLoading(false);});
  return()=>{active=false;};
 },[year,refresh]);
 const rows=Array.isArray(data?.rows)?data.rows:[];
 const available=currencies.filter(c=>rows.some(r=>r.currency===c));
 const other=[...new Set(rows.map(x=>x.currency))].filter(c=>!currencies.includes(c));
 const allCurrencies=[...available,...other];
 const categories=useMemo(()=>[...new Set(rows.filter(r=>r.period==="MONTH"&&r.group==="INVOICED_PURCHASES").map(r=>r.category))].filter(Boolean),[rows]);
 return <main className="min-h-screen min-w-0 overflow-x-clip bg-[#070e22] px-3 py-5 text-slate-100 sm:px-6 lg:px-8">
  <div className="mx-auto min-w-0 max-w-7xl">
   <header className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[.04] p-4">
    <Link href="/finance" className="flex items-center gap-2 font-semibold text-cyan-200"><ArrowLeft size={17}/> Centrum finansów</Link><UserMenu/>
   </header>
   <Navbar/>
   <div className="mt-8 flex flex-wrap items-end justify-between gap-4">
    <div className="min-w-0">
     <p className="text-xs font-bold uppercase tracking-widest text-cyan-300">Financial Agent</p>
     <h1 className="mt-2 break-words text-3xl font-black sm:text-4xl">Raport miesięczny i kwartalny</h1>
     <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
      Sprzedaż i koszty liczone według daty wystawienia i kwot brutto faktur KSeF.
      To nie są rzeczywiste wpływy i wypływy z banku. Rzeczywiste przepływy
      pieniężne pokażemy po autoryzowanym podłączeniu banku.
     </p>
    </div>
    <div className="flex flex-wrap items-end gap-2">
     <label className="text-sm text-slate-300">Rok
      <select value={year} onChange={e=>setYear(Number(e.target.value))}
       className="mt-1 block min-h-11 rounded-xl border border-white/20 bg-[#101d3c] px-4 py-2 text-white">
       {Array.from({length:8},(_,i)=>new Date().getFullYear()+1-i).map(y=><option key={y} value={y}>{y}</option>)}
      </select>
     </label>
     <button onClick={()=>setRefresh(x=>x+1)} disabled={loading}
      className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/20 px-4 text-sm disabled:opacity-40">
      <RefreshCw size={16}/> Odśwież
     </button>
    </div>
   </div>
   <div className="mt-5 flex items-start gap-3 rounded-2xl border border-amber-400/20 bg-amber-400/[.06] p-4 text-xs leading-6 text-amber-100">
    <Info size={18} className="mt-0.5 shrink-0"/>
    Kwoty w różnych walutach są pokazywane osobno. Faktura wystawiona nie jest dowodem zapłaty.
    Rodzaje kosztów stanowią klasyfikację zarządczą, nie kwalifikację podatkową.
   </div>
   {loading&&<p className="mt-7 text-sm text-slate-300">Obliczanie zestawień…</p>}
   {error&&<p className="mt-7 text-sm text-rose-200" role="alert">{error}</p>}
   {!loading&&!error&&allCurrencies.length===0&&<p className="mt-7 text-sm text-slate-300">Brak faktur w wybranym roku.</p>}
   {!loading&&!error&&allCurrencies.map(cur=><section key={cur} className="mt-7 min-w-0 overflow-hidden rounded-3xl border border-white/10 bg-white/[.045]">
    <div className="flex items-center gap-3 border-b border-white/10 p-5">
     <ChartNoAxesColumn size={21} className="text-cyan-300"/>
     <h2 className="text-xl font-bold">Waluta: {cur}</h2>
    </div>
    <div className="max-w-full overflow-x-auto">
     <table className="min-w-[760px] w-full text-left text-sm">
      <thead className="text-xs uppercase text-slate-400"><tr>
       <th className="p-4">Miesiąc</th><th className="p-4">Sprzedaż z faktur</th>
       <th className="p-4">Faktury zakupowe</th><th className="p-4">Koszty stałe*</th>
       <th className="p-4">Różnica fakturowa*</th>
      </tr></thead>
      <tbody>{MONTHS.map((name,i)=>{
       const s=total(rows,"MONTH",i+1,cur,"INVOICED_SALES");
       const c=total(rows,"MONTH",i+1,cur,"INVOICED_PURCHASES");
       const fixed=total(rows,"MONTH",i+1,cur,"INVOICED_PURCHASES",row=>row.costType==="FIXED");
       return <tr key={name} className="border-t border-white/10">
        <td className="p-4 font-semibold">{name}</td>
        <td className="p-4 tabular-nums">{money(s,cur)}</td>
        <td className="p-4 tabular-nums">{money(c,cur)}</td>
        <td className="p-4 tabular-nums">{money(fixed,cur)}</td>
        <td className="p-4 tabular-nums font-semibold">{money(s-c,cur)}</td>
       </tr>;
      })}</tbody>
     </table>
    </div>
    <div className="border-t border-white/10 p-5">
     <h3 className="text-lg font-bold">Kwartały</h3>
     <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {[1,2,3,4].map(q=>{
       const sale=total(rows,"QUARTER",q,cur,"INVOICED_SALES");
       const purchase=total(rows,"QUARTER",q,cur,"INVOICED_PURCHASES");
       return <div key={q} className="rounded-xl border border-white/10 bg-slate-950/30 p-4">
        <p className="font-bold text-cyan-200">Q{q}</p>
        <p className="mt-3 text-xs text-slate-400">Faktury sprzedażowe</p>
        <p className="mt-1 break-words font-semibold tabular-nums">{money(sale,cur)}</p>
        <p className="mt-3 text-xs text-slate-400">Faktury zakupowe</p>
        <p className="mt-1 break-words font-semibold tabular-nums">{money(purchase,cur)}</p>
       </div>;
      })}
     </div>
     <h3 className="mt-6 text-lg font-bold">Koszty według kategorii — cały rok</h3>
     <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{categories.map(category=>{
      const val=[1,2,3,4].reduce((n,q)=>n+total(rows,"QUARTER",q,cur,"INVOICED_PURCHASES",row=>row.category===category),0);
      if(val===0)return null;
      return <div key={category} className="min-w-0 rounded-xl border border-white/10 bg-slate-950/30 p-4">
       <p className="text-xs text-slate-400">{CATEGORY_LABELS[category]||category}</p>
       <p className="mt-2 break-words text-lg font-bold tabular-nums">{money(val,cur)}</p>
      </div>;
     })}</div>
    </div>
   </section>)}
   <p className="mt-6 text-xs leading-6 text-slate-400">*Koszt stały jest kategorią pomocniczą, nie potwierdzeniem faktycznej cykliczności płatności. Różnica fakturowa nie jest zyskiem ani przepływem gotówki.</p>
  </div>
 </main>;
}
