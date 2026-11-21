"use client";
import {useEffect,useState} from "react";
import Link from "next/link";
import {ArrowLeft,RefreshCw,FileText,ShieldCheck,Clock3} from "lucide-react";
import Navbar from "../../components/Navbar";
import UserMenu from "../../components/UserMenu";
import {getKsefHistoryStatus,queueKsefHistoryImport} from "@/lib/api";

function date(value){
 if(!value)return "—";
 const d=new Date(value);
 return Number.isFinite(d.getTime())?d.toLocaleString("pl-PL"):"—";
}
const states={
 READY:"Gotowa do uruchomienia",
 DISABLED:"Synchronizacja wyłączona",
 OWNER_NOT_CONFIGURED:"Brak właściciela KSeF",
 TOKEN_MISSING:"Brak tokenu KSeF",
 ENVIRONMENT_NOT_PRODUCTION:"Środowisko KSeF niegotowe",
 INVALID_NIP:"Niepoprawny NIP KSeF"
};
export default function KsefBackfillStatusPage(){
 const [data,setData]=useState(null);
 const [loading,setLoading]=useState(true);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");
 const [notice,setNotice]=useState("");
 const [refresh,setRefresh]=useState(0);
 useEffect(()=>{
  let active=true;setError("");setLoading(true);
  getKsefHistoryStatus().then(res=>{if(active)setData(res?.data||null);})
   .catch(err=>{if(active)setError(err?.message||"Nie można sprawdzić historii KSeF.");})
   .finally(()=>{if(active)setLoading(false);});
  return()=>{active=false;};
 },[refresh]);
 async function start(){
  if(busy)return;setBusy(true);setNotice("");setError("");
  try{
   const result=await queueKsefHistoryImport();
   setNotice(result?.data?.queued?
    "Zlecono najbliższy bezpieczny cykl pobierania. Postęp sprawdź po zakończeniu działania agenta.":
    "Agent już pracuje lub pobieranie oczekuje w kolejce.");
   setRefresh(n=>n+1);
  }catch(err){setError(err?.message||"Nie można zlecić synchronizacji.");}
  finally{setBusy(false);}
 }
 return <main className="min-h-screen min-w-0 overflow-x-clip bg-[#080e20] px-3 py-5 pb-24 text-slate-100 sm:px-6">
  <div className="mx-auto max-w-5xl">
   <header className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-[#111c35] p-4">
    <Link href="/finance" className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-cyan-200"><ArrowLeft size={17}/> Centrum finansów</Link><UserMenu/>
   </header><Navbar/>
   <section className="mt-5 rounded-2xl border border-violet-400/20 bg-gradient-to-r from-[#221a46] to-[#123552] p-5 sm:p-7">
    <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-violet-200"><FileText size={16}/> KSeF — historia faktur</p>
    <h1 className="mt-3 text-2xl font-black sm:text-3xl">Postęp importu historycznego</h1>
    <p className="mt-3 text-sm leading-6 text-slate-200">Osobno dla Dekonica i Deherus. Postęp pochodzi z zapisanych dat ostatniego pobranego okresu — nie z liczby wystawionych faktur.</p>
   </section>
   <div className="mt-5 flex flex-wrap gap-2">
    <button type="button" disabled={loading} onClick={()=>setRefresh(n=>n+1)}
     className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/15 px-4 text-sm disabled:opacity-50"><RefreshCw size={16}/> Odśwież</button>
    {data?.ownerSyncStatus==="READY"&&data?.agentEnabled&&<button type="button" disabled={busy||loading} onClick={start}
     className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-violet-600 px-4 text-sm font-bold disabled:opacity-50">
     <Clock3 size={16}/>{busy?"Zlecam…":"Pobierz kolejne okresy"}</button>}
   </div>
   {loading&&<p role="status" className="mt-4 text-sm text-slate-300">Sprawdzam zapisane kursory pobierania…</p>}
   {error&&<p role="alert" className="mt-4 rounded-xl border border-rose-400/25 bg-rose-500/10 p-4 text-sm text-rose-200">{error}</p>}
   {notice&&<p role="status" className="mt-4 rounded-xl border border-emerald-400/25 bg-emerald-500/10 p-4 text-sm text-emerald-200">{notice}</p>}
   {data&&!loading&&<section className="mt-5">
    <p className="text-sm text-slate-300">Synchronizacja właściciela: <strong>{states[data.ownerSyncStatus]||data.ownerSyncStatus}</strong>
     {" · "}Agent: {data.agentEnabled?"włączony":"wyłączony"}</p>
    <p className="mt-1 text-xs text-slate-400">Ostatni cykl agenta: {date(data.lastAgentRunAt)} · kolejny: {date(data.nextAgentRunAt)}</p>
    <div className="mt-4 grid gap-4 md:grid-cols-2">
     {(data.companies||[]).map(item=><article key={item.company} className="rounded-2xl border border-white/10 bg-[#111c35] p-5">
      <div className="flex items-start justify-between gap-3">
       <h2 className="text-lg font-bold">{item.company}</h2>
       <span className={"text-xs "+(item.syncConfigured?"text-emerald-200":"text-amber-200")}>
        {item.syncConfigured?"Synchronizacja skonfigurowana":"Synchronizacja nieaktywna"}
       </span>
      </div>
      <p className="mt-3 text-2xl font-black tabular-nums">{item.history.progressPercent}%</p>
      <div aria-label={"Postęp okresów "+item.company} className="mt-2 h-2 w-full overflow-hidden rounded-full bg-white/15">
       <div className="h-full rounded-full bg-violet-400" style={{width:item.history.progressPercent+"%"}}/>
      </div>
      <p className="mt-3 text-sm text-slate-300">Ostatni zapisany punkt: <strong>{date(item.history.checkpointAt)}</strong></p>
      <p className="mt-1 text-xs text-slate-400">Do bieżącego zakresu: około {item.history.remainingDays} dni historii.</p>
      <p className="mt-1 text-xs text-slate-400">Początek importu: {date(item.history.startAt)} · koniec zakresu: {date(item.history.recentCutoffAt)}</p>
      <p className="mt-3 text-xs text-slate-400">{item.history.complete?
       "Osiągnięto aktualny zakres dat. To nie potwierdza pobrania wszystkich faktur XML.":
       "Pozostały kolejne okna pobierania. Postęp wzrasta dopiero po ukończeniu obu kierunków KSeF."}</p>
     </article>)}
    </div>
   </section>}
   <p className="mt-6 flex items-start gap-2 text-xs leading-5 text-slate-400"><ShieldCheck size={17} className="shrink-0"/>
    Nie mieszamy danych spółek. Procent pokazuje postęp pobierania przedziałów czasowych i nie jest wskaźnikiem liczby pobranych faktur ani księgowej kompletności.
   </p>
  </div>
 </main>;
}
