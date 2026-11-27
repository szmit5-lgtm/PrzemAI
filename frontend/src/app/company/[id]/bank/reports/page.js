"use client";
import {useEffect,useMemo,useState} from "react";
import Link from "next/link";
import {useParams} from "next/navigation";
import {ArrowLeft,Landmark,RefreshCw,ShieldCheck,Wallet,FileSpreadsheet,Info} from "lucide-react";
import Navbar from "../../../../components/Navbar";
import UserMenu from "../../../../components/UserMenu";
import {getOrganization,getOrganizationBankMonthlyReport,getOrganizationBankActivity} from "@/lib/api";

const MONTHS=["Styczeń","Luty","Marzec","Kwiecień","Maj","Czerwiec",
 "Lipiec","Sierpień","Wrzesień","Październik","Listopad","Grudzień"];
const money=(amount,currency="PLN")=>{
 if(amount==null)return "Brak potwierdzonego salda";
 const n=Number(amount);
 if(!Number.isFinite(n))return "—";
 try{return new Intl.NumberFormat("pl-PL",{style:"currency",currency}).format(n);}
 catch{return amount+" "+currency;}
};
const balance=(value,currency)=>value==null?"—":money(value,currency);
const accountType=type=>type==="VAT"?"Rachunek VAT":type==="CURRENT"?"Rachunek bieżący":"Inny rachunek";

function CashflowChart({id,year,months}){
 const [selection,setSelection]=useState(null);
 const [result,setResult]=useState(null);
 const [error,setError]=useState("");
 const rows=months.map(({month,currencies})=>({month,values:currencies.find(row=>row.currency==="PLN")}));
 const max=Math.max(1,...rows.flatMap(row=>["inflows","outflows"].map(key=>Number(row.values?.[key]||0))));
 useEffect(()=>{
  if(!selection)return;
  let active=true;
  getOrganizationBankActivity(id,year,selection.month,{direction:selection.direction,currency:"PLN",offset:selection.offset})
   .then(response=>{if(active)setResult(response.data);})
   .catch(error=>{if(active)setError(error.message);});
  return()=>{active=false;};
 },[id,year,selection]);
 function select(month,direction,offset=0){
  setResult(null);setError("");setSelection({month,direction,offset});
 }
 return <section id="cashflow" className="mt-5 scroll-mt-6 rounded-2xl border border-white/10 bg-[#111c35] p-4">
  <h3 className="font-bold">Przepływy miesięczne · PLN</h3>
  <p className="mt-1 text-sm text-slate-300">Wybierz wpływy lub wydatki w miesiącu, aby wyświetlić operacje.</p>
  <div className="mt-4 grid grid-cols-6 gap-2 md:grid-cols-12">
   {rows.map(({month,values})=><div key={month} className="text-center">
    <div className="flex h-24 items-end justify-center gap-1">
     {["inflows","outflows"].map(direction=>{
      const label=(direction==="inflows"?"Wpływy":"Wydatki")+" · "+MONTHS[month-1];
      const value=Number(values?.[direction]||0);
      return <button key={direction} type="button" onClick={()=>select(month,direction)}
       title={label+" · "+money(value)} aria-label={label+" · "+money(value)}
       aria-pressed={selection?.month===month&&selection?.direction===direction}
       className={"w-4 rounded-t border border-white/20 focus-visible:outline-2 aria-pressed:ring-2 "+(direction==="inflows"?"bg-emerald-500":"bg-rose-500")}
       style={{height:Math.max(5,value/max*100)+"%"}}/>;
     })}
    </div>
    <span className="text-xs text-slate-300">{MONTHS[month-1].slice(0,3)}</span>
   </div>)}
  </div>
  {selection&&<div className="mt-4 border-t border-white/10 pt-3" aria-live="polite">
   <h4 className="font-semibold">{selection.direction==="inflows"?"Wpływy":"Wydatki"} · {MONTHS[selection.month-1]}</h4>
   {error?<p role="alert" className="text-rose-200">{error}</p>:!result?<p>Wczytywanie operacji…</p>:
    result.items.length===0?<p>Brak operacji w tym okresie.</p>:
    <ul className="mt-2 divide-y divide-white/10 text-sm">
     {result.items.map(row=><li key={row.id} className="flex flex-wrap justify-between gap-2 py-2">
      <span>{row.bookedAt.slice(0,10)} · {row.counterparty||row.description||"Operacja bankowa"}
       {row.counterparty&&row.description&&<span className="block text-slate-400">{row.description}</span>}
      </span>
      <span>{money(row.amount)} · {accountType(row.accountType)}</span>
     </li>)}
    </ul>}
   {selection.offset>0&&<button type="button" className="mr-4 underline" onClick={()=>select(selection.month,selection.direction,selection.offset-50)}>Wstecz</button>}
   {result?.hasMore&&<button type="button" className="underline" onClick={()=>select(selection.month,selection.direction,selection.offset+50)}>Dalej</button>}
  </div>}
 </section>;
}

export default function CompanyBankMonthlyReports(){
 const {id}=useParams();
 const today=new Date(),initialYear=today.getFullYear();
 const [yearInput,setYearInput]=useState(String(initialYear));
 const [year,setYear]=useState(initialYear);
 const [company,setCompany]=useState(null);
 const [report,setReport]=useState(null);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState("");
 const [refresh,setRefresh]=useState(0);
 const [month,setMonth]=useState(null);
 const [quarter,setQuarter]=useState(0);
 useEffect(()=>{
  if(!id)return;
  let active=true;
  setLoading(true);setError("");setReport(null);setCompany(null);
  Promise.all([getOrganization(id),getOrganizationBankMonthlyReport(id,year)])
   .then(([org,result])=>{
    if(!active)return;
    if(org?.data?.id!==id||result?.data?.organizationId!==id||
     result?.data?.year!==year||!Array.isArray(result?.data?.months))
     throw Error("Serwer nie potwierdził zestawienia tej spółki.");
    setCompany(org.data);setReport(result.data);
    // When opening a report, show the latest month with actual bank data,
    // rather than defaulting to today's often-unreconciled month.
    const meaningful=result.data.months.filter(entry=>entry.accounts.some(acc=>
     acc.confirmedMonthEnd||acc.transactionCount>0));
    const latest=meaningful.at(-1)?.month||(year===today.getFullYear()?today.getMonth()+1:12);
    setMonth(previous=>previous??latest);
   }).catch(err=>{if(active)setError(err?.message||"Nie udało się przygotować zestawienia.");})
    .finally(()=>{if(active)setLoading(false);});
  return()=>{active=false;};
 },[id,year,refresh]);
 const selected=useMemo(()=>quarter
  ?report?.quarters?.find(x=>x.quarter===quarter)||null
  :report?.months?.find(x=>x.month===month)||null,[report,month,quarter]);
 const periodLabel=quarter?"Kwartał "+quarter:MONTHS[month-1];
 const pln=selected?.currencies?.find(x=>x.currency==="PLN")||null;
 const totals=report?.months||[];
 function submit(event){
  event.preventDefault();
  const number=Number(yearInput);
  if(!Number.isInteger(number)||number<2020||number>2100){
   setError("Wybierz rok od 2020 do 2100.");return;
  }
  setMonth(null);
  setYear(number);setRefresh(x=>x+1);
 }
 return <main className="min-h-screen min-w-0 overflow-x-clip bg-[#080e20] px-3 py-5 pb-24 text-slate-100 sm:px-6 lg:px-8">
  <div className="mx-auto max-w-7xl">
   <header className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-[#111c35] p-4">
    <Link href={"/company/"+encodeURIComponent(id)+"/bank"} className="inline-flex min-h-11 items-center gap-2 text-sm font-bold text-violet-200">
     <ArrowLeft size={18}/> Powrót do banku
    </Link><UserMenu/>
   </header>
   <Navbar/>
   <section className="mt-5 rounded-3xl border border-violet-400/25 bg-gradient-to-r from-[#211745] to-[#113451] p-5 sm:p-7">
    <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-violet-200">
     <Landmark size={16}/> Zestawienia bankowe
    </p>
    <h1 className="mt-2 break-words text-2xl font-black sm:text-4xl">
     Salda i przepływy — {company?.displayName||company?.name||"spółka"}
    </h1>
    <p className="mt-3 max-w-4xl text-sm leading-6 text-slate-200">
     Stan rachunku bieżącego i rachunku VAT osobno, suma obu rachunków, miesięczne i kwartalne wpływy, wydatki oraz kontrahenci.
     Wyniki są obliczane wyłącznie na podstawie wyciągów tej spółki.
    </p>
   </section>

   <Link href="/company/bank/compare"
    className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl border border-cyan-400/25 bg-cyan-500/10 px-4 text-sm font-semibold text-cyan-200">
    <Landmark size={17}/> Porównaj Dekonica, Deherus i inne spółki
   </Link>
   <form onSubmit={submit} className="mt-5 flex flex-wrap items-end gap-3 rounded-2xl border border-white/10 bg-[#111c35] p-4">
    <label className="text-sm font-semibold">Rok
     <input type="number" min="2020" max="2100" step="1" value={yearInput}
      onChange={e=>setYearInput(e.target.value)}
      className="mt-2 block min-h-11 w-32 rounded-xl border border-white/15 bg-[#0c1930] px-3"/>
    </label>
    <label className="text-sm font-semibold">Kwartał
     <select value={quarter} onChange={e=>setQuarter(Number(e.target.value))}
      className="mt-2 block min-h-11 rounded-xl border border-white/15 bg-[#0c1930] px-3">
      <option value={0}>Raport miesięczny</option>
      {[1,2,3,4].map(value=><option key={value} value={value}>Kwartał {value}</option>)}
     </select>
    </label>
    {!quarter&&<label className="text-sm font-semibold">Miesiąc
     <select value={month||today.getMonth()+1} onChange={e=>setMonth(Number(e.target.value))}
      className="mt-2 block min-h-11 w-44 rounded-xl border border-white/15 bg-[#0c1930] px-3">
      {MONTHS.map((label,index)=><option key={index} value={index+1}>{label}</option>)}
     </select>
    </label>}
    <button type="submit" disabled={loading} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-violet-600 px-4 text-sm font-bold text-white disabled:opacity-50">
     <RefreshCw size={16}/> Pokaż zestawienie
    </button>
   </form>

   {loading&&<p role="status" className="mt-5 text-sm text-slate-300">Obliczam zestawienie z zaimportowanych wyciągów…</p>}
   {error&&<p role="alert" className="mt-5 rounded-xl border border-rose-400/30 bg-rose-500/10 p-4 text-sm text-rose-200">{error}</p>}
   {!loading&&!error&&selected&&<>
    <div className="mt-5">
     <h2 className="text-lg font-bold">Stan na {new Date(selected.lastDay).toLocaleDateString("pl-PL",{timeZone:"UTC"})}</h2>
     <p className="mt-1 text-xs text-slate-400">Saldo pochodzi z wyciągu zamykającego miesiąc. Gdy brakuje takiego wyciągu, nie zgadujemy wartości.</p>
    </div>
    <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
     <article className="rounded-2xl border border-violet-400/25 bg-[#111c35] p-5">
      <p className="flex items-center gap-2 text-sm font-semibold text-violet-200"><Wallet size={19}/> Rachunek bieżący · PLN</p>
      <p className="mt-3 text-2xl font-black tabular-nums">{pln?balance(pln.currentBalance,"PLN"):"—"}</p>
      <p className="mt-2 text-xs text-slate-400">Środki na rachunku bieżącym</p>
     </article>
     <article className="rounded-2xl border border-cyan-400/25 bg-[#111c35] p-5">
      <p className="flex items-center gap-2 text-sm font-semibold text-cyan-200"><Landmark size={19}/> Rachunek VAT · PLN</p>
      <p className="mt-3 text-2xl font-black tabular-nums">{pln?balance(pln.vatBalance,"PLN"):"—"}</p>
      <p className="mt-2 text-xs text-slate-400">Środki VAT z ograniczeniami wykorzystania</p>
     </article>
     <article className="rounded-2xl border border-white/15 bg-[#111c35] p-5">
      <p className="flex items-center gap-2 text-sm font-semibold text-slate-200"><FileSpreadsheet size={19}/> Razem · PLN</p>
      <p className="mt-3 text-2xl font-black tabular-nums">{pln?balance(pln.balance,"PLN"):"—"}</p>
      <p className="mt-2 text-xs text-slate-400">Suma obu rachunków, niekoniecznie dostępna gotówka</p>
     </article>
    </div>
    <CashflowChart key={id+"-"+year} id={id} year={year} months={totals}/>
    <section className="mt-4 rounded-2xl border border-white/10 bg-[#111c35] p-5">
     <h3 className="text-base font-bold">Wpływy i wydatki · {periodLabel} {year}</h3>
     <div className="mt-4 grid gap-3 sm:grid-cols-3">
      <p className="text-sm text-slate-300">Wpływy <strong className="mt-1 block text-lg text-emerald-200 tabular-nums">{pln?money(pln.inflows,"PLN"):"—"}</strong></p>
      <p className="text-sm text-slate-300">Wydatki <strong className="mt-1 block text-lg text-rose-200 tabular-nums">{pln?money(pln.outflows,"PLN"):"—"}</strong></p>
      <p className="text-sm text-slate-300">Bilans operacji <strong className="mt-1 block text-lg tabular-nums">{pln?money(pln.net,"PLN"):"—"}</strong></p>
     </div>
     <p className="mt-3 text-xs text-slate-400">Wpływy i wydatki obejmują również operacje pomiędzy własnymi rachunkami (np. przelewy VAT). Nie są równoznaczne z przychodami i kosztami księgowymi.</p>
    </section>
    <section className="mt-5 rounded-2xl border border-white/10 bg-[#111c35] p-4 sm:p-6">
     <h3 className="text-lg font-bold">Rachunki · {periodLabel}</h3>
     <div className="mt-3 grid gap-3 md:grid-cols-2">
      {selected.accounts.map(account=><article key={account.accountId} className="rounded-xl border border-white/10 bg-white/[.035] p-4">
       <p className="font-bold">{accountType(account.accountType)} · •••• {account.ibanSuffix} · {account.currency}</p>
       <p className="mt-3 text-xl font-bold">{balance(account.closingBalance,account.currency)}</p>
       <p className="mt-2 text-xs text-slate-300">{account.transactionCount} operacji · wpływy {money(account.inflows,account.currency)} · wydatki {money(account.outflows,account.currency)}</p>
       {!account.confirmedMonthEnd&&<p className="mt-2 flex items-start gap-2 text-xs text-amber-200"><Info size={15} className="mt-0.5 shrink-0"/> Brak wyciągu potwierdzającego saldo na ostatni dzień miesiąca. {account.lastKnownAt?"Ostatnie znane saldo: "+money(account.lastKnownBalance,account.currency)+" ("+account.lastKnownAt+").":""}</p>}
      </article>)}
     </div>
    </section>
    {!!selected.counterparties?.length&&<section className="mt-5 rounded-2xl border border-white/10 bg-[#111c35] p-4 sm:p-6">
     <h3 className="text-lg font-bold">Kontrahenci · {periodLabel}</h3>
     <div className="mt-4 overflow-x-auto">
      <table className="w-full min-w-[480px] text-left text-sm">
       <thead><tr>{["Kontrahent","Operacje","Wpływy","Wydatki"].map(label=><th key={label} className="p-2">{label}</th>)}</tr></thead>
       <tbody>{selected.counterparties.map(row=><tr key={JSON.stringify([row.currency,row.counterparty])} className="border-t border-white/10">
        <td className="p-2">{row.counterparty||"Brak kontrahenta w wyciągu"}</td>
        <td className="p-2">{row.count}</td>
        <td className="p-2 tabular-nums">{money(row.inflows,row.currency)}</td>
        <td className="p-2 tabular-nums">{money(row.outflows,row.currency)}</td>
       </tr>)}</tbody>
      </table>
     </div>
    </section>}
    <section className="mt-5 rounded-2xl border border-white/10 bg-[#111c35] p-4 sm:p-6">
     <h3 className="text-lg font-bold">Porównanie miesięcy · {year}</h3>
     <p className="mt-2 text-xs text-slate-400">Oddzielnie rachunek bieżący i VAT. Kwoty PLN; inne waluty nie są przeliczane ani dodawane.</p>
     <div className="mt-4 overflow-x-auto rounded-xl border border-white/10">
      <table className="min-w-[850px] w-full border-collapse text-left text-sm">
       <thead className="bg-white/5 text-xs text-slate-300"><tr>
        {["Miesiąc","Wpływy PLN","Wydatki PLN","Rachunek bieżący PLN","Rachunek VAT PLN","Razem PLN"].map(h=><th key={h} className="px-3 py-3">{h}</th>)}
       </tr></thead>
       <tbody>{totals.map(entry=>{
        const x=entry.currencies.find(c=>c.currency==="PLN");
        return <tr key={entry.month} className={"border-t border-white/10 "+(entry.month===month?"bg-violet-500/10":"")}>
         <td className="px-3 py-3 font-semibold">{MONTHS[entry.month-1]}</td>
         <td className="px-3 py-3 tabular-nums">{x?money(x.inflows,"PLN"):"—"}</td>
         <td className="px-3 py-3 tabular-nums">{x?money(x.outflows,"PLN"):"—"}</td>
         <td className="px-3 py-3 tabular-nums">{x?balance(x.currentBalance,"PLN"):"—"}</td>
         <td className="px-3 py-3 tabular-nums">{x?balance(x.vatBalance,"PLN"):"—"}</td>
         <td className="px-3 py-3 font-bold tabular-nums">{x?balance(x.balance,"PLN"):"—"}</td>
        </tr>;
       })}</tbody>
      </table>
     </div>
    </section>
    {selected.currencies.filter(c=>c.currency!=="PLN").length>0&&<section className="mt-5 rounded-xl border border-white/10 bg-[#111c35] p-4">
     <h3 className="font-bold">Inne waluty · {periodLabel}</h3>
     {selected.currencies.filter(c=>c.currency!=="PLN").map(x=><p key={x.currency} className="mt-2 text-sm text-slate-300">{x.currency}: {balance(x.balance,x.currency)} · wpływy {money(x.inflows,x.currency)} · wydatki {money(x.outflows,x.currency)}</p>)}
    </section>}
   </>}
   <p className="mt-6 flex items-start gap-2 text-xs leading-5 text-slate-400"><ShieldCheck size={16} className="shrink-0"/>
    Raport widoczny tylko dla osób z uprawnieniami finansowymi do tej spółki. Własny rachunek VAT jest pokazany osobno, a brakujące salda pozostają puste.
   </p>
  </div>
 </main>;
}
