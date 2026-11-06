"use client";
import {useEffect,useState} from "react";
import Link from "next/link";
import {Bot,RefreshCw,Play,Wallet,ArrowUpRight,CheckCircle2,Clock3,ToggleLeft,ToggleRight,ShieldCheck,MessageSquareText} from "lucide-react";
import Navbar from "../components/Navbar";
import UserMenu from "../components/UserMenu";
import {getAgents,getIntegrations,runAgent,setAgentEnabled} from "@/lib/api";
import {parseAgentDashboardResponses,parseAgentRunResponse,parseAgentToggleResponse,canRunAgent,getAgentStatusClass} from "@/lib/agentDashboardPayload";

const integratedModules=[
 {key:"general",name:"General",headline:"Asystent ogólny i rozmowy",
  description:"Funkcja ogólnego asystenta jest dostępna w czacie PrzemAI.",href:"/chat",
  linkedTo:"Czat PrzemAI"},
 {key:"ksef",name:"KSeF",headline:"Integracja faktur",
  description:"Pobieranie i analiza faktur jest obsługiwana przez Financial Agent.",href:"/finance",
  linkedTo:"Financial Agent"},
 {key:"personal",name:"Personal Assistant",headline:"Osobista pomoc w pracy",
  description:"Prowadzenie rozmów i przygotowywanie poleceń jest dostępne w Asystencie AI.",href:"/chat",
  linkedTo:"Asystent AI"}
];

function date(value){if(!value)return "Jeszcze nie uruchamiano";const d=new Date(value);return Number.isNaN(d.getTime())?"—":d.toLocaleString("pl-PL");}
export default function AgentsPage(){
 const [agents,setAgents]=useState([]),[loading,setLoading]=useState(true);
 const [pending,setPending]=useState(""),[error,setError]=useState(""),[notice,setNotice]=useState("");
 const [refresh,setRefresh]=useState(0);
 useEffect(()=>{
   let live=true;(async()=>{setLoading(true);setError("");
     try{const [a,i]=await Promise.all([getAgents(),getIntegrations()]);
       const value=parseAgentDashboardResponses(a,i);
       if(live)setAgents(value.agents);
     }catch(e){if(live)setError(e.message||"Nie udało się pobrać agentów.");}
     finally{if(live)setLoading(false);}
   })();return()=>{live=false;};
 },[refresh]);
 const change=async(name,action)=>{
   if(pending)return;setPending(name);setError("");setNotice("");
   try{await action();setNotice("Zapisano. Stan agentów został odświeżony.");setRefresh(x=>x+1);}
   catch(e){setError(e.message||"Operacja nie powiodła się.");}
   finally{setPending("");}
 };
 const active=agents.filter(a=>a.enabled).length;
 const totalVisible=agents.length+integratedModules.length;
 return <main className="min-h-screen min-w-0 overflow-x-clip bg-[#080e20] px-3 py-5 text-slate-100 sm:px-6 lg:px-8">
   <div className="mx-auto w-full max-w-[1540px] min-w-0">
     <header className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[.04] p-4">
       <Link href="/" className="text-xl font-black text-white">Przem<span className="text-violet-300">AI</span></Link><UserMenu/>
     </header>
     <Navbar/>
     <section className="mt-6 min-w-0">
       <div className="flex flex-wrap items-center justify-between gap-4">
         <div className="min-w-0">
           <p className="text-xs font-bold uppercase tracking-[.18em] text-cyan-300">Centrum agentów</p>
           <h1 className="mt-2 break-words text-3xl font-black sm:text-4xl">Twój zespół PrzemAI</h1>
           <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">Każdy agent ma opis zadań, ograniczeń i osobną przestrzeń pracy. Wpisz polecenie, śledź realizację i odbierz wynik. Wysyłanie wiadomości oraz działania poza PrzemAI wymagają dodatkowych integracji i zatwierdzenia.</p>
         </div>
         <button type="button" disabled={loading||!!pending} onClick={()=>setRefresh(x=>x+1)}
           className="flex min-h-11 items-center gap-2 rounded-xl border border-white/20 px-4 py-2 text-sm font-semibold hover:bg-white/10 disabled:opacity-50">
           <RefreshCw size={17} className={loading?"animate-spin":""}/> Odśwież
         </button>
       </div>
       <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
         <div className="min-w-0 rounded-2xl border border-white/10 bg-white/[.05] p-4"><Bot className="text-cyan-300"/><p className="mt-2 text-3xl font-black">{loading?"—":totalVisible}</p><p className="text-xs text-slate-400">Agentów i modułów w systemie</p></div>
         <div className="min-w-0 rounded-2xl border border-white/10 bg-white/[.05] p-4"><CheckCircle2 className="text-emerald-300"/><p className="mt-2 text-3xl font-black">{loading?"—":active}</p><p className="text-xs text-slate-400">Włączone agenty wykonawcze</p></div>
         <div className="min-w-0 rounded-2xl border border-white/10 bg-white/[.05] p-4"><MessageSquareText className="text-cyan-300"/><p className="mt-2 text-base font-bold">Polecenie → wynik</p><p className="mt-2 text-xs leading-5 text-slate-400">Asystenci przygotowują szkice i analizy. Financial Agent ma dodatkowo integrację KSeF.</p></div>
       </div>
     </section>
     {error&&<p role="alert" className="mt-5 rounded-xl border border-rose-300/30 bg-rose-300/10 p-4 text-sm text-rose-200">{error}</p>}
     {notice&&<p role="status" className="mt-5 rounded-xl border border-cyan-300/20 bg-cyan-300/5 p-4 text-sm text-cyan-100">{notice}</p>}
     {loading?<p className="mt-8 text-slate-300">Pobieranie agentów…</p>:
       <section className="mt-7 grid min-w-0 gap-4 md:grid-cols-2 xl:grid-cols-3">
         {agents.map(a=><article key={a.id} className={"flex min-w-0 flex-col overflow-hidden rounded-3xl border p-5 sm:p-6 "+(a.key==="sales"?"border-cyan-300/35 bg-gradient-to-br from-[#163455] to-[#0d182e]":"border-white/10 bg-[#101d37]")}>
           <div className="flex min-w-0 items-start justify-between gap-2">
             <div className="flex min-w-0 items-center gap-3">
               <div className="shrink-0 rounded-xl border border-cyan-400/20 bg-cyan-400/10 p-3"><Bot className="text-cyan-300" size={21}/></div>
               <div className="min-w-0"><h2 className="break-words text-lg font-extrabold">{a.name}</h2>
                 <p className="mt-1 text-xs text-violet-200">{a.headline||a.type}</p>
               </div>
             </div>
             <span className={"shrink-0 rounded-full border px-2 py-1 text-[11px] "+getAgentStatusClass(a.status)}>{a.status==="RUNNING"?"Pracuje":a.enabled?"Włączony":"Wyłączony"}</span>
           </div>
           <p className="mt-4 min-w-0 break-words text-sm leading-6 text-slate-200">{a.description||"Opis specjalizacji jest przygotowywany."}</p>
           <h3 className="mt-5 text-xs font-bold uppercase tracking-wider text-slate-400">Co potrafi</h3>
           <ul className="mt-2 space-y-1.5">{(a.capabilities||[]).map((cap,i)=><li key={i} className="flex items-start gap-2 text-xs leading-5 text-slate-200"><CheckCircle2 className="mt-0.5 shrink-0 text-cyan-300" size={14}/>{cap}</li>)}</ul>
           <p className="mt-4 break-words text-xs leading-5 text-slate-400"><strong className="text-slate-300">Granice działania:</strong> {a.limitations||"Brak skonfigurowanych zadań."}</p>
           <div className="mt-auto border-t border-white/10 pt-5">
             <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
               <Clock3 size={13}/> {a.intervalMinutes} min · {date(a.lastRunAt)}
             </div>
             <div className="mt-4 flex flex-wrap gap-2">
               <Link href={a.key==="financial"?"/finance":"/agents/"+a.key}
                 className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-violet-400 px-4 py-2.5 text-sm font-bold text-slate-950 hover:bg-violet-300">
                 {a.key==="financial"?<Wallet size={16}/>:<MessageSquareText size={16}/>}
                 {a.key==="financial"?"Centrum finansów":"Zleć zadanie"} <ArrowUpRight size={15}/>
               </Link>
               <button type="button" disabled={loading||!!pending||!canRunAgent(a)}
                 onClick={()=>change("run:"+a.id,()=>runAgent(a.id).then(parseAgentRunResponse))}
                 title="Uruchom kolejny cykl obsługi zleceń"
                 className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/20 px-3 py-2 text-xs font-semibold hover:bg-white/10 disabled:opacity-40">
                 <Play size={15}/> Uruchom
               </button>
               <button type="button" disabled={loading||!!pending||a.status==="RUNNING"}
                 aria-label={a.enabled?"Wyłącz agenta":"Włącz agenta"}
                 onClick={()=>change("toggle:"+a.id,()=>setAgentEnabled(a.id,!a.enabled).then(r=>parseAgentToggleResponse(r,{id:a.id,enabled:!a.enabled})))}
                 className="inline-flex min-h-11 items-center rounded-xl border border-white/20 px-3 text-sm hover:bg-white/10 disabled:opacity-40">
                 {a.enabled?<ToggleRight size={19} className="text-emerald-300"/>:<ToggleLeft size={19}/>}
               </button>
             </div>
           </div>
         </article>)}
       </section>}
     <section className="mt-9 min-w-0">
      <div className="flex flex-wrap items-center justify-between gap-3">
       <h2 className="text-xl font-bold">Moduły powiązane z agentami</h2>
       <span className="rounded-full border border-violet-400/25 bg-violet-500/10 px-3 py-1 text-xs text-violet-200">3 moduły z pierwotnego planu</span>
      </div>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">Te funkcje już działają w ramach innych elementów PrzemAI. Nie tworzymy ich drugi raz jako niezależnych agentów, żeby nie dublować danych i integracji.</p>
      <div className="mt-4 grid min-w-0 gap-4 md:grid-cols-3">
       {integratedModules.map(item=><article key={item.key} className="flex min-w-0 flex-col rounded-2xl border border-violet-400/15 bg-[#111c35] p-5">
        <div className="flex items-start justify-between gap-2"><h3 className="text-base font-bold">{item.name}</h3>
         <span className="rounded-full border border-violet-400/20 bg-violet-500/10 px-2 py-1 text-[11px] text-violet-200">Zintegrowany</span>
        </div>
        <p className="mt-1 text-xs font-semibold text-violet-300">{item.headline}</p>
        <p className="mt-3 flex-1 text-sm leading-6 text-slate-300">{item.description}</p>
        <Link href={item.href} className="mt-4 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-violet-400/20 bg-violet-400/10 px-4 text-sm font-semibold text-violet-200 hover:bg-violet-400/20">
         Otwórz: {item.linkedTo} <ArrowUpRight size={15}/>
        </Link>
       </article>)}
      </div>
     </section>
     <footer className="mt-10 flex items-center gap-2 text-xs text-slate-500"><ShieldCheck size={14}/> Zlecenia i wyniki są przypisane do zalogowanego konta.</footer>
   </div>
 </main>;
}
