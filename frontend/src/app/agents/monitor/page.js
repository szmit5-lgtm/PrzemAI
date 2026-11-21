"use client";
import {useEffect,useState} from "react";
import Link from "next/link";
import {ArrowLeft,Activity,Clock3,RefreshCw,ShieldCheck,AlertTriangle,CheckCircle2} from "lucide-react";
import Navbar from "../../components/Navbar";
import UserMenu from "../../components/UserMenu";
import {getAgentMonitoring} from "@/lib/api";

const labels={READY:"Gotowy",RUNNING:"Pracuje",ATTENTION:"Błąd — sprawdź",DISABLED:"Wyłączony",
 OVERDUE:"Opóźniony cykl",NO_RUNS:"Brak potwierdzonych uruchomień"};
const bg={READY:"text-emerald-200",RUNNING:"text-cyan-200",ATTENTION:"text-rose-200",
 DISABLED:"text-slate-400",OVERDUE:"text-amber-200",NO_RUNS:"text-amber-200"};
const taskStatus={TODO:"W kolejce",IN_PROGRESS:"W trakcie",ERROR:"Błąd — wymaga sprawdzenia"};
const fmt=x=>{
 if(!x)return "—";
 const date=new Date(x);
 return Number.isFinite(date.getTime())?date.toLocaleString("pl-PL"):"—";
};
export default function AgentMonitoringPage(){
 const [data,setData]=useState(null),[loading,setLoading]=useState(true);
 const [error,setError]=useState(""),[refresh,setRefresh]=useState(0);
 useEffect(()=>{
  let live=true;setLoading(true);setError("");
  getAgentMonitoring().then(r=>{
   if(!live)return;
   if(r?.data?.source!=="PERSISTED_AGENT_AUDIT"||!Array.isArray(r?.data?.agents))
    throw Error("Serwer nie potwierdził monitoringu agentów.");
   setData(r.data);
  }).catch(err=>{if(live)setError(err?.message||"Nie udało się pobrać stanu agentów.");})
   .finally(()=>{if(live)setLoading(false);});
  return()=>{live=false;};
 },[refresh]);
 useEffect(()=>{
  const timer=setInterval(()=>setRefresh(x=>x+1),30000);
  return()=>clearInterval(timer);
 },[]);
 const totals=data?.totals||{queued:0,working:0,completed:0,failed:0};
 return <main className="min-h-screen min-w-0 overflow-x-clip bg-[#080e20] px-3 py-5 pb-24 text-slate-100 sm:px-6">
  <div className="mx-auto max-w-7xl">
   <header className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-[#111c35] p-4">
    <Link href="/agents" className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-cyan-200">
     <ArrowLeft size={18}/> Centrum agentów
    </Link><UserMenu/>
   </header><Navbar/>
   <section className="mt-5 rounded-3xl border border-violet-400/25 bg-gradient-to-r from-[#221a46] to-[#12364e] p-5 sm:p-7">
    <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-violet-200">
     <Activity size={16}/> Centrum monitorowania
    </p>
    <h1 className="mt-2 text-2xl font-black sm:text-4xl">Agenci 24/7 — faktyczny stan pracy</h1>
    <p className="mt-3 max-w-4xl text-sm leading-6 text-slate-200">
     Kolejka zleceń, wykonane prace, błędy i ostatnie uruchomienia. Dane pochodzą z bazy PrzemAI,
     a nie z deklaracji, że agent jest włączony. Odświeżanie co 30 sekund podczas otwartej strony.
    </p>
   </section>
   <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
    <p className="text-xs text-slate-400">Ostatni odczyt: {fmt(data?.checkedAt)}</p>
    <button type="button" onClick={()=>setRefresh(x=>x+1)} disabled={loading}
     className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/20 px-4 text-sm font-semibold disabled:opacity-50">
     <RefreshCw size={16} className={loading?"animate-spin":""}/> Odśwież stan
    </button>
   </div>
   {loading&&<p role="status" className="mt-5 text-sm text-slate-300">Sprawdzam trwałe zlecenia i historię wykonania…</p>}
   {error&&<p role="alert" className="mt-5 rounded-xl border border-rose-400/25 bg-rose-400/10 p-4 text-sm text-rose-200">{error}</p>}
   {!error&&data&&<div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
    {[
     {name:"W kolejce",value:totals.queued},
     {name:"Agent pracuje",value:totals.working},
     {name:"Zakończone",value:totals.completed},
     {name:"Z błędem",value:totals.failed}
    ].map(item=><div key={item.name} className="rounded-2xl border border-white/10 bg-[#111c35] p-4">
     <p className="text-xs text-slate-400">{item.name}</p><p className="mt-2 text-3xl font-black tabular-nums">{item.value}</p>
    </div>)}
   </div>}
   {data&&!error&&<section className="mt-6">
    <h2 className="text-xl font-bold">Stan poszczególnych agentów</h2>
    <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
     {data.agents.map(agent=><article key={agent.id} className="rounded-2xl border border-white/10 bg-[#111c35] p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
       <div className="min-w-0"><h3 className="break-words text-base font-bold">{agent.name}</h3>
        <p className="mt-1 text-xs text-slate-400">Cykl: {agent.intervalMinutes} min</p></div>
       <span className={"text-xs font-bold "+(bg[agent.state]||"text-slate-300")}>
        {labels[agent.state]||agent.state}
       </span>
      </div>
      <div className="mt-4 space-y-2 text-sm text-slate-300">
       <p className="flex items-center gap-2"><Clock3 size={15}/> Ostatnia praca: {fmt(agent.lastRunAt||agent.lastRun?.finishedAt)}</p>
       <p>Następne zaplanowane uruchomienie: <strong>{fmt(agent.nextRunAt)}</strong></p>
       <p>Ostatni zapisany wynik: <strong>{agent.lastRun?
        (agent.lastRun.status==="SUCCESS"?"Zakończony":
         agent.lastRun.status==="RUNNING"?"Trwa":"Błąd"):"Brak historii"}</strong></p>
       {agent.lastRun?.summary&&<p className="break-words text-xs text-slate-400">{agent.lastRun.summary}</p>}
       {agent.state==="OVERDUE"&&<p className="flex items-start gap-2 text-xs text-amber-200"><AlertTriangle size={15} className="shrink-0"/> Uruchomienie jest spóźnione; sprawdź serwer i kolejkę.</p>}
      </div>
      <Link href={agent.key==="financial"?"/finance":"/agents/"+encodeURIComponent(agent.key)}
       className="mt-4 inline-flex min-h-10 items-center rounded-xl border border-violet-300/25 bg-violet-400/10 px-3 text-xs font-semibold text-violet-200">
       {agent.key==="financial"?"Przejdź do Finansów":"Otwórz zlecenia agenta"}
      </Link>
     </article>)}
    </div>
   </section>}
   {data&&!error&&<section className="mt-6 rounded-2xl border border-white/10 bg-[#111c35] p-4 sm:p-6">
    <h2 className="text-xl font-bold">Otwarte zlecenia i sprawy do poprawy</h2>
    <p className="mt-2 text-xs leading-5 text-slate-400">
     Lista obejmuje maksymalnie 120 ostatnio aktualizowanych otwartych spraw.
     {data.truncated?" Spraw jest więcej — pełną historię sprawdź w przestrzeni właściwego agenta.":""}
    </p>
    {!data.openItems.length?<p className="mt-5 flex items-center gap-2 text-sm text-emerald-200"><CheckCircle2 size={17}/> Brak otwartych zleceń w tym zestawieniu.</p>:
     <div className="mt-4 space-y-2">{data.openItems.map(item=><article key={item.id}
      className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[.035] p-3">
      <div className="min-w-0 flex-1">
       <p className="break-words text-sm font-semibold">{item.title}</p>
       <p className="mt-1 text-xs text-slate-400">{item.agentKey||"Nieznany agent"} · zlecono {fmt(item.createdAt)}</p>
      </div>
      <p className={"text-xs font-bold "+(item.status==="ERROR"?"text-rose-200":"text-cyan-200")}>
       {taskStatus[item.status]||item.status}
      </p>
     </article>)}</div>}
   </section>}
   <p className="mt-6 flex items-start gap-2 text-xs leading-5 text-slate-400">
    <ShieldCheck size={17} className="shrink-0"/> Monitoring jest przypisany do zalogowanego konta.
    Sprawdza zapisane wykonania, nie mierzy ciągłej dostępności serwera i nie gwarantuje ukończenia wszystkich zleceń.
    Zlecenia z błędem wymagają sprawdzenia, a wysyłanie wiadomości nadal wymaga odpowiedniej integracji i zgody.
   </p>
  </div>
 </main>;
}
