"use client";
import {useEffect,useMemo,useState} from "react";
import Link from "next/link";
import {useParams} from "next/navigation";
import {ArrowLeft,Building2,FileText,RefreshCw,ShieldCheck,AlertTriangle} from "lucide-react";
import Navbar from "../../../../components/Navbar";
import UserMenu from "../../../../components/UserMenu";
import {getOrganizationInvestmentFinanceReport,getOrganization} from "@/lib/api";

const MONTHS=["Sty","Lut","Mar","Kwi","Maj","Cze","Lip","Sie","Wrz","Paź","Lis","Gru"];
const fmt=(amount,currency="PLN")=>{
 if(amount==null)return "—";
 const number=Number(amount);
 if(!Number.isFinite(number))return "—";
 try{return new Intl.NumberFormat("pl-PL",{style:"currency",currency}).format(number);}
 catch{return String(amount)+" "+currency;}
};
const directionLabel={INCOMING:"Zakupy (faktury kosztowe)",OUTGOING:"Sprzedaż (faktury przychodowe)"};
const statusLabel={IN_PROGRESS:"W realizacji",COMPLETED:"Zakończona",ON_HOLD:"Wstrzymana",NOT_SET:"Brak statusu"};

function ProjectCard({item}){
 const linked=item.accountMapping==="EXACT_NAME"||item.accountMapping==="ONLY_KSEF";
 const empty=!item.documents;
 const [expanded,setExpanded]=useState(false);
 return <article className="min-w-0 rounded-2xl border border-white/10 bg-[#111c35] p-4 sm:p-5">
  <div className="flex flex-wrap items-start justify-between gap-2">
   <div className="min-w-0">
    <h3 className="break-words text-lg font-bold">{item.name}</h3>
    <p className="mt-1 text-xs text-slate-400">
     {item.accountMapping==="EXACT_NAME"?"Jednoznaczne powiązanie z projektem KSeF":
      item.accountMapping==="ONLY_KSEF"?"Projekt księgowy KSeF — brak identycznej inwestycji firmowej":
      item.accountMapping==="AMBIGUOUS"?"Niejednoznaczna nazwa — wymaga powiązania":
      "Brak identycznej nazwy w projektach KSeF — kosztów nie przypisano"}
    </p>
   </div>
   <div className="text-right text-xs text-slate-300">
    <p>{item.status?statusLabel[item.status]||item.status:"Projekt KSeF"}</p>
    <p className="mt-1">{item.progress==null?"":"Realizacja "+item.progress+"%"}</p>
   </div>
  </div>
  {linked&&<p className="mt-4 text-sm font-semibold text-slate-200">Zaimportowane faktury przypisane do projektu: {item.documents}</p>}
  {!linked?<p className="mt-4 rounded-xl border border-amber-300/20 bg-amber-400/[.05] p-3 text-sm text-amber-100">
   Brak jednoznacznego przyporządkowania faktur. Nie pokazujemy kwoty 0 zł, ponieważ nie oznaczałaby ona rzeczywistego kosztu inwestycji.
  </p>:empty?<p className="mt-4 text-sm text-slate-400">
   Nie znaleziono przypisanych faktur w wybranym roku. To nie oznacza, że inwestycja nie poniosła kosztów.
  </p>:<div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
   {item.totals.map(x=><div key={x.currency+"-"+x.direction} className="rounded-xl border border-white/10 bg-[#0c1932] p-3">
    <p className="text-xs font-bold text-slate-300">{directionLabel[x.direction]||x.direction} · {x.currency}</p>
    <p className="mt-2 text-xl font-black tabular-nums">{fmt(x.net,x.currency)} <span className="text-xs font-normal text-slate-400">netto</span></p>
    <p className="mt-1 text-sm tabular-nums text-slate-300">VAT: {fmt(x.vat,x.currency)}</p>
    <p className="mt-1 text-sm tabular-nums text-slate-300">Brutto: {fmt(x.gross,x.currency)}</p>
    <p className="mt-2 text-xs text-slate-400">{x.count} faktur</p>
    {(x.missingNet||x.missingVat||x.missingGross)?<p className="mt-2 text-xs text-amber-200">Część kwot nie została rozpoznana. Nie podano niepełnej sumy jako całości.</p>:null}
   </div>)}
  </div>}
  {linked&&!empty&&<div className="mt-4">
   <button type="button" onClick={()=>setExpanded(x=>!x)}
    className="min-h-10 rounded-lg border border-violet-300/25 bg-violet-400/10 px-3 text-xs font-semibold text-violet-200">
    {expanded?"Ukryj miesiące":"Pokaż koszty i sprzedaż według miesięcy"}
   </button>
   {expanded&&<div className="mt-3 overflow-x-auto rounded-lg border border-white/10">
    <table className="w-full min-w-[660px] border-collapse text-left text-xs">
     <thead className="bg-white/5 text-slate-300">
      <tr>{["Miesiąc","Rodzaj","Waluta","Netto","VAT","Brutto","Faktury"].map(h=><th key={h} className="px-3 py-3">{h}</th>)}</tr>
     </thead>
     <tbody>{item.months.map((row,i)=><tr key={i} className="border-t border-white/10">
      <td className="px-3 py-3">{MONTHS[row.month-1]}</td>
      <td className="px-3 py-3">{row.direction==="INCOMING"?"Zakupy":"Sprzedaż"}</td>
      <td className="px-3 py-3">{row.currency}</td>
      <td className="px-3 py-3 tabular-nums">{fmt(row.net,row.currency)}</td>
      <td className="px-3 py-3 tabular-nums">{fmt(row.vat,row.currency)}</td>
      <td className="px-3 py-3 tabular-nums">{fmt(row.gross,row.currency)}</td>
      <td className="px-3 py-3">{row.count}</td>
     </tr>)}</tbody>
    </table>
   </div>}
  </div>}
 </article>;
}

export default function InvestmentFinancePage(){
 const {id}=useParams();
 const [year,setYear]=useState(new Date().getFullYear());
 const [yearInput,setYearInput]=useState(String(new Date().getFullYear()));
 const [report,setReport]=useState(null);
 const [company,setCompany]=useState("");
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState("");
 const [refresh,setRefresh]=useState(0);
 useEffect(()=>{
  if(!id)return;
  let live=true;setLoading(true);setError("");setReport(null);
  Promise.all([getOrganization(id),getOrganizationInvestmentFinanceReport(id,year)])
   .then(([org,r])=>{
    if(!live)return;
    if(r?.data?.organizationId!==id||r?.data?.year!==year||
     r?.data?.source!=="KSEF_PROJECT_ASSIGNMENTS"||
     !Array.isArray(r?.data?.investments))throw Error("Serwer nie potwierdził raportu inwestycji dla wybranej spółki.");
    setCompany(org?.data?.displayName||org?.data?.name||"");
    setReport(r.data);
   }).catch(err=>{if(live)setError(err?.message||"Nie udało się przygotować raportu inwestycji.");})
    .finally(()=>{if(live)setLoading(false);});
  return()=>{live=false;};
 },[id,year,refresh]);
 function submit(event){
  event.preventDefault();const selected=Number(yearInput);
  if(!Number.isInteger(selected)||selected<2020||selected>2100){
   setError("Rok musi być liczbą od 2020 do 2100.");return;
  }
  setYear(selected);setRefresh(v=>v+1);
 }
 const highlighted=useMemo(()=>report?.investments||[],[report]);
 const withoutOrganization=report?.otherKsefProjects||[];
 return <main className="min-h-screen min-w-0 overflow-x-clip bg-[#080e20] px-3 py-5 pb-24 text-slate-100 sm:px-6 lg:px-8">
  <div className="mx-auto max-w-6xl">
   <header className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-[#111c35] p-4">
    <Link href={"/company/"+encodeURIComponent(id)+"/finance"} className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-violet-200">
     <ArrowLeft size={18}/> Finanse spółki
    </Link><UserMenu/>
   </header><Navbar/>
   <section className="mt-5 rounded-3xl border border-cyan-400/20 bg-gradient-to-r from-[#17354a] to-[#221b45] p-5 sm:p-7">
    <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-cyan-200"><Building2 size={16}/> Wydatki i przychody przypisane do inwestycji</p>
    <h1 className="mt-2 text-2xl font-black sm:text-3xl">Raport inwestycji — {company||"spółka"}</h1>
    <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-200">
     Faktury zakupowe i sprzedażowe KSeF przypisane do projektów: Mielno, Zgorzelec i pozostałe inwestycje.
     Bez domyślnego przypisywania nieznanych pozycji. Raport nie oznacza rzeczywistych przelewów ani marży budowlanej.
    </p>
   </section>
   <form onSubmit={submit} className="mt-5 flex flex-wrap items-end gap-3 rounded-2xl border border-white/10 bg-[#111c35] p-4">
    <label className="text-sm font-semibold">Rok rozliczenia
     <input type="number" min="2020" max="2100" value={yearInput} onChange={e=>setYearInput(e.target.value)}
      className="mt-2 block min-h-11 w-36 rounded-xl border border-white/15 bg-[#0c1930] px-3"/>
    </label>
    <button disabled={loading} type="submit"
     className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-violet-600 px-4 text-sm font-bold text-white disabled:opacity-50">
     <RefreshCw size={16}/> Pokaż zestawienie
    </button>
   </form>
   {loading&&<p role="status" className="mt-5 text-sm text-slate-300">Zbieram faktury według projektów i spółki…</p>}
   {error&&<p role="alert" className="mt-5 rounded-xl border border-rose-400/25 bg-rose-400/10 p-4 text-sm text-rose-200">{error}</p>}
   {!loading&&!error&&report&&<>
    <section className="mt-5 grid gap-3 sm:grid-cols-3">
     {[{name:"Faktury przypisane do projektów",value:report.counts.matchedInvoices},
       {name:"Bez przypisanej inwestycji",value:report.counts.unassignedInvoices},
       {name:"Wymagające weryfikacji katalogu",value:report.counts.otherProjectAssignments}].filter(x=>x.value!=null).map(x=>
      <article key={x.name} className="rounded-xl border border-white/10 bg-[#111c35] p-4">
       <p className="text-xs text-slate-300">{x.name}</p>
       <p className="mt-2 text-3xl font-black tabular-nums">{x.value}</p>
      </article>)}
    </section>
    {report.counts.unassignedInvoices>0&&<p className="mt-4 flex items-start gap-2 rounded-xl border border-amber-400/20 bg-amber-400/5 p-4 text-sm text-amber-100">
     <AlertTriangle size={18} className="mt-0.5 shrink-0"/> Są faktury nieprzypisane do projektu. Nie doliczamy ich arbitralnie do Mielna ani Zgorzelca.
    </p>}
    <section className="mt-6">
     <h2 className="text-xl font-bold">Inwestycje firmy</h2>
     {highlighted.length? <div className="mt-4 grid gap-4">{highlighted.map(item=><ProjectCard key={item.id} item={item}/>)}</div>:
      <p className="mt-3 text-sm text-slate-300">Nie znaleziono inwestycji w przestrzeni tej spółki.</p>}
    </section>
    {withoutOrganization.length>0&&<section className="mt-6">
     <h2 className="text-lg font-bold">Projekty rozliczane w KSeF bez identycznej karty inwestycji</h2>
     <p className="mt-1 text-xs text-slate-400">Faktury pozostają w swoich projektach księgowych. Nie przenosimy ich do innej inwestycji na podstawie podobieństwa nazw.</p>
     <div className="mt-4 grid gap-4">{withoutOrganization.map(item=><ProjectCard key={item.id} item={item}/>)}</div>
    </section>}
    <p className="mt-6 flex items-start gap-2 text-xs leading-5 text-slate-400"><ShieldCheck size={16} className="shrink-0"/>
     Raport obejmuje tylko faktury KSeF przypisane do właściwego NIP i projektów należących do tej spółki. Kwoty w różnych walutach nie są sumowane. Nie obejmuje wynagrodzeń, gotówki, kosztów poza KSeF ani niepotwierdzonych płatności.
    </p>
   </>}
  </div>
 </main>;
}
