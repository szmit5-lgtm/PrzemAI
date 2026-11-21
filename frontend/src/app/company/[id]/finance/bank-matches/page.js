"use client";
import {useEffect,useMemo,useState} from "react";
import Link from "next/link";
import {useParams} from "next/navigation";
import {ArrowLeft,FileText,Landmark,ShieldCheck,RefreshCw,AlertTriangle} from "lucide-react";
import Navbar from "../../../../components/Navbar";
import UserMenu from "../../../../components/UserMenu";
import {getOrganizationBankKsefMatches,getOrganization} from "@/lib/api";
const money=(value,currency)=>{
 if(value==null)return "—";
 const n=Number(value);
 if(!Number.isFinite(n))return "—";
 try{return new Intl.NumberFormat("pl-PL",{style:"currency",currency}).format(n);}
 catch{return String(value)+" "+currency;}
};
const kind={INCOMING:"Zakup / płatność wychodząca",OUTGOING:"Sprzedaż / wpływ"};
function Candidate({item}) {
 return <article className="rounded-xl border border-white/10 bg-white/[.035] p-4">
  <div className="flex flex-wrap items-start justify-between gap-2">
   <div className="min-w-0">
    <p className="text-sm font-bold">{item.invoiceNumber||"Faktura bez numeru"}</p>
    <p className="mt-1 text-xs text-slate-300">{kind[item.direction]} · {item.contractor||"Kontrahent"} · {item.invoiceDate}</p>
   </div>
   <p className="text-lg font-bold tabular-nums">{money(item.grossAmount,item.currency)}</p>
  </div>
  <div className="mt-3 rounded-lg border border-cyan-400/15 bg-cyan-500/5 p-3 text-sm">
   <p>Operacja z dnia <strong>{item.bookedAt}</strong> · rachunek •••• {item.accountSuffix}</p>
   <p className="mt-1 break-words text-xs text-slate-300">{item.description||"Brak opisu przelewu"}</p>
   <p className="mt-2 font-semibold">{money(item.transactionAmount,item.currency)}</p>
  </div>
  <p className="mt-2 text-xs text-amber-200">
   {item.confidence==="AMBIGUOUS"?
    "Kilka możliwych dopasowań — wymaga ręcznej analizy.":
    item.confidence==="STRONG"?
    "Zgodny numer faktury, kwota i okres — sprawdź przed potwierdzeniem.":
    "Zgodna kwota, okres i kontrahent — możliwe dopasowanie do sprawdzenia."}
  </p>
 </article>;
}
export default function BankKsefMatchesPage(){
 const {id}=useParams();
 const [year,setYear]=useState(new Date().getFullYear());
 const [draft,setDraft]=useState(String(new Date().getFullYear()));
 const [company,setCompany]=useState("");
 const [report,setReport]=useState(null);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState("");
 const [refresh,setRefresh]=useState(0);
 const summary=useMemo(()=>report?.totals||null,[report]);
 useEffect(()=>{
  if(!id)return;
  let active=true;
  setLoading(true);setError("");setReport(null);
  Promise.all([getOrganization(id),getOrganizationBankKsefMatches(id,year)]).then(([org,result])=>{
   if(!active)return;
   if(org?.data?.id!==id||result?.data?.organizationId!==id||
    result?.data?.year!==year||result?.data?.source!=="KSEF_BANK_SUGGESTIONS")
    throw Error("Nie potwierdzono zakresu danych spółki.");
   setCompany(org.data.displayName||org.data.name||"");
   setReport(result.data);
  }).catch(err=>{if(active)setError(err?.message||"Nie można przygotować rozliczeń.");})
   .finally(()=>{if(active)setLoading(false);});
  return()=>{active=false;};
 },[id,year,refresh]);
 function chooseYear(event){
  event.preventDefault();
  const next=Number(draft);
  if(!Number.isInteger(next)||next<2020||next>2100){
   setError("Podaj poprawny rok od 2020 do 2100.");return;
  }
  setYear(next);setRefresh(x=>x+1);
 }
 return <main className="min-h-screen min-w-0 overflow-x-clip bg-[#080e20] px-3 py-5 pb-24 text-slate-100 sm:px-6">
  <div className="mx-auto max-w-6xl">
   <header className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-[#111c35] p-4">
    <Link href={"/company/"+encodeURIComponent(id)+"/finance"} className="inline-flex min-h-11 items-center gap-2 text-sm text-violet-200">
     <ArrowLeft size={18}/> Finanse spółki
    </Link><UserMenu/>
   </header>
   <Navbar/>
   <section className="mt-5 rounded-2xl border border-cyan-400/25 bg-gradient-to-r from-[#163a4e] to-[#241c46] p-5 sm:p-7">
    <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-cyan-200"><Landmark size={16}/> Bank + KSeF</p>
    <h1 className="mt-3 text-2xl font-black sm:text-3xl">Możliwe rozliczenia faktur — {company||"spółka"}</h1>
    <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-200">
     System porównuje rzeczywiście pobrane faktury i transakcje tej spółki.
     Pokazuje zgodność kwoty, okresu i numeru faktury lub kontrahenta.
     <strong> Nie zmienia statusu faktur i nie oznacza żadnej płatności jako potwierdzonej.</strong>
    </p>
   </section>
   <form onSubmit={chooseYear} className="mt-5 flex flex-wrap items-end gap-3 rounded-2xl border border-white/10 bg-[#111c35] p-4">
    <label className="text-sm font-semibold">Rok faktur
     <input type="number" min="2020" max="2100" step="1" value={draft}
      onChange={e=>setDraft(e.target.value)}
      className="mt-2 block min-h-11 w-32 rounded-xl border border-white/15 bg-[#0b1730] px-3"/>
    </label>
    <button type="submit" disabled={loading} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-violet-600 px-4 text-sm font-bold text-white disabled:opacity-50">
     <RefreshCw size={17}/> Porównaj
    </button>
   </form>
   {loading&&<p role="status" className="mt-5 text-sm text-slate-300">Porównuję faktury z operacjami bankowymi…</p>}
   {error&&<p role="alert" className="mt-5 rounded-xl border border-rose-400/30 bg-rose-500/10 p-4 text-sm text-rose-200">{error}</p>}
   {!loading&&!error&&report&&<>
    <section className="mt-5 grid gap-3 sm:grid-cols-3">
     {[
      {name:"Faktury sprawdzone",count:summary?.invoicesExamined||0},
      {name:"Propozycje jednoznaczne",count:summary?.uniqueProposals||0},
      {name:"Niejednoznaczne",count:summary?.conflictingCandidates||0}
     ].map(item=><div key={item.name} className="rounded-xl border border-white/10 bg-[#111c35] p-4">
      <p className="text-xs text-slate-400">{item.name}</p><p className="mt-2 text-3xl font-black">{item.count}</p>
     </div>)}
    </section>
    <section className="mt-5 rounded-2xl border border-white/10 bg-[#111c35] p-4 sm:p-6">
     <h2 className="flex items-center gap-2 text-lg font-bold"><FileText size={19}/> Propozycje do sprawdzenia</h2>
     <p className="mt-2 text-xs text-slate-400">Dopasowania wyłącznie na podstawie danych w systemie. Nie oznaczają spłaty całego zobowiązania.</p>
     {report.proposed.length?
      <div className="mt-4 grid gap-3 md:grid-cols-2">{report.proposed.map(x=><Candidate key={x.invoiceId+"|"+x.transactionId} item={x}/>)}</div>:
      <p className="mt-4 text-sm text-slate-400">Nie znaleziono jednoznacznych propozycji w wybranym roku. Nie oznacza to, że faktury są nieopłacone.</p>}
    </section>
    {report.conflicts.length>0&&<section className="mt-5 rounded-2xl border border-amber-400/25 bg-[#111c35] p-4 sm:p-6">
     <h2 className="flex items-center gap-2 text-lg font-bold"><AlertTriangle size={19} className="text-amber-300"/> Wymagają ręcznej analizy</h2>
     <div className="mt-4 grid gap-3 md:grid-cols-2">{report.conflicts.map(x=><Candidate key={x.invoiceId+"|"+x.transactionId} item={x}/>)}</div>
    </section>}
   </>}
   <p className="mt-5 flex items-start gap-2 text-xs leading-5 text-slate-400"><ShieldCheck size={16} className="shrink-0"/>
    Przegląd jest dostępny wyłącznie po osobnym sprawdzeniu uprawnień bankowych i KSeF danej spółki.
    Przelewy dzielone, płatności częściowe, kompensaty i split payment mogą nie zostać dopasowane.
   </p>
  </div>
 </main>;
}
