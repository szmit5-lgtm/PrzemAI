"use client";
import {useEffect,useState} from "react";
import Link from "next/link";
import {useParams} from "next/navigation";
import {ArrowLeft,RefreshCw,Send,Clipboard,CheckCircle2,Clock3,BriefcaseBusiness} from "lucide-react";
import Navbar from "../../components/Navbar";
import UserMenu from "../../components/UserMenu";
import {getAgents,getAgentAssignments,createAgentAssignment,setAgentAssignmentStage,replyToAgentAssignment} from "@/lib/api";

const STAGES=[["NEW","Nowy kontakt"],["QUALIFIED","Zakwalifikowany"],["PROPOSAL","Oferta"],["FOLLOW_UP","Kontakt ponowny"],["WON","Wygrany"],["LOST","Utracony"]];
function fmt(v){if(!v)return "—";const d=new Date(v);return isNaN(d.getTime())?"—":d.toLocaleString("pl-PL");}
export default function AgentWorkspace(){
 const {key}=useParams();const [agent,setAgent]=useState(null),[tasks,setTasks]=useState([]);
 const [instruction,setInstruction]=useState(""),[client,setClient]=useState(""),[contact,setContact]=useState("");
 const [company,setCompany]=useState("Dekonica"),[project,setProject]=useState(""),[stage,setStage]=useState("NEW");
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState("");
 const [refresh,setRefresh]=useState(0);
 const [replyDrafts,setReplyDrafts]=useState({});
 const [replyBusy,setReplyBusy]=useState("");
 const hasPending=tasks.some(t=>t.status==="TODO"||t.status==="IN_PROGRESS");
 useEffect(()=>{
   if(!hasPending)return;
   const timer=setInterval(()=>{
     getAgentAssignments(key).then(r=>{
       if(Array.isArray(r?.data))setTasks(r.data);
     }).catch(()=>{});
   },10000);
   return()=>clearInterval(timer);
 },[hasPending,key]);
 useEffect(()=>{
  let alive=true;setLoading(true);setError("");
  Promise.all([getAgents(),getAgentAssignments(key)]).then(([a,t])=>{
   if(!alive)return;
   setAgent(Array.isArray(a?.data)?a.data.find(x=>x.key===key):null);
   setTasks(Array.isArray(t?.data)?t.data:[]);
  }).catch(e=>{if(alive)setError(e.message||"Nie można pobrać zleceń.");})
    .finally(()=>{if(alive)setLoading(false);});
  return()=>{alive=false;};
 },[key,refresh]);
 async function send(event){
  event.preventDefault();if(busy||!instruction.trim())return;
  setBusy(true);setError("");setNotice("");
  try{
   await createAgentAssignment(key,{instruction,client,contact,company,project,stage});
   setInstruction("");setNotice("Zlecenie zapisane i przekazane agentowi. Wynik pojawi się w historii po wykonaniu.");
   setRefresh(v=>v+1);
  }catch(e){setError(e.message||"Nie można zlecić zadania.");}
  finally{setBusy(false);}
 }
 async function sendReply(event,task){
  event.preventDefault();
  const text=(replyDrafts[task.id]||"").trim();
  if(replyBusy||!text)return;
  setReplyBusy(task.id);setError("");setNotice("");
  try{
    await replyToAgentAssignment(key,task.id,text);
    setReplyDrafts(previous=>({...previous,[task.id]:""}));
    setNotice("Odpowiedź przekazana agentowi. Kontynuuje tę samą sprawę.");
    setRefresh(v=>v+1);
  }catch(e){setError(e.message||"Nie można wysłać odpowiedzi.");}
  finally{setReplyBusy("");}
 }
 async function updateStage(id,next){
  setBusy(true);setError("");
  try{await setAgentAssignmentStage(key,id,next);setRefresh(v=>v+1);}
  catch(e){setError(e.message||"Nie można zmienić etapu.");}
  finally{setBusy(false);}
 }
 const sales=key==="sales";
 return <main className="min-h-screen min-w-0 overflow-x-clip bg-[#070e22] px-3 py-5 text-slate-100 sm:px-6 lg:px-8">
  <div className="mx-auto w-full min-w-0 max-w-7xl">
   <header className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[.04] p-4">
     <Link href="/agents" className="inline-flex items-center gap-2 text-sm font-bold text-cyan-200"><ArrowLeft size={18}/> Agenci</Link><UserMenu/>
   </header>
   <Navbar/>
   {loading?<p className="mt-8">Pobieram przestrzeń agenta…</p>:!agent?
     <p className="mt-8 text-slate-300">Nie znaleziono tego agenta. <Link href="/agents" className="text-cyan-200 underline">Wróć do agentów</Link>.</p>:
    <>
     <section className="mt-6 min-w-0 rounded-3xl border border-white/10 bg-gradient-to-br from-[#152c50] to-[#0d162b] p-5 sm:p-7">
      <p className="text-xs font-bold uppercase tracking-widest text-cyan-300">Przestrzeń pracy</p>
      <h1 className="mt-2 break-words text-3xl font-black sm:text-4xl">{agent.name}</h1>
      <p className="mt-3 max-w-4xl text-sm leading-7 text-slate-200">{agent.description}</p>
      <p className="mt-3 text-xs leading-5 text-slate-400"><strong className="text-white">Ważne:</strong> {agent.limitations}</p>
     </section>
     <div className="mt-6 grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
      <section className="min-w-0 rounded-3xl border border-white/10 bg-white/[.045] p-4 sm:p-6">
       <h2 className="flex items-center gap-2 text-xl font-bold"><Send className="text-cyan-300" size={19}/> Nowe zlecenie</h2>
       <p className="mt-2 text-sm text-slate-400">Opisz zadanie własnymi słowami. Agent przygotuje odpowiedź i zapisze ją tutaj.</p>
       <form onSubmit={send} className="mt-5 space-y-4">
        {sales&&<div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
         <label className="text-xs text-slate-300">Klient / firma<input value={client} onChange={e=>setClient(e.target.value)}
           maxLength={200} placeholder="Nazwa klienta (opcjonalnie)" className="mt-2 w-full min-w-0 rounded-xl border border-white/20 bg-[#10213d] p-3 text-sm text-white"/></label>
         <label className="text-xs text-slate-300">Kontakt<input value={contact} onChange={e=>setContact(e.target.value)}
           maxLength={200} placeholder="E-mail lub telefon" className="mt-2 w-full min-w-0 rounded-xl border border-white/20 bg-[#10213d] p-3 text-sm text-white"/></label>
         <label className="text-xs text-slate-300">Spółka<input value={company} onChange={e=>setCompany(e.target.value)}
           maxLength={200} className="mt-2 w-full min-w-0 rounded-xl border border-white/20 bg-[#10213d] p-3 text-sm text-white"/></label>
         <label className="text-xs text-slate-300">Etap sprzedaży<select value={stage} onChange={e=>setStage(e.target.value)}
           className="mt-2 w-full min-w-0 rounded-xl border border-white/20 bg-[#10213d] p-3 text-sm text-white">
           {STAGES.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>
        </div>}
        <label className="block text-xs text-slate-300">Projekt / inwestycja
          <input value={project} onChange={e=>setProject(e.target.value)} placeholder="np. Zgorzelec, schrony, Mielno"
            maxLength={200} className="mt-2 w-full min-w-0 rounded-xl border border-white/20 bg-[#10213d] p-3 text-sm text-white"/>
        </label>
        <label className="block text-sm font-semibold text-slate-200">Polecenie dla agenta
          <textarea required minLength={5} maxLength={8000} rows={7} value={instruction} onChange={e=>setInstruction(e.target.value)}
            placeholder={sales?"Np. Przygotuj ofertę współpracy dla inwestora zainteresowanego modułowymi schronami. Zaproponuj pierwszą wiadomość i follow-up.":"Opisz dokładnie, czego potrzebujesz, i podaj informacje źródłowe."}
            className="mt-2 w-full min-w-0 resize-y rounded-xl border border-white/20 bg-[#10213d] p-4 text-sm leading-6 text-white placeholder:text-slate-500"/>
        </label>
        <button disabled={busy||!agent.enabled||instruction.trim().length<5} type="submit"
         className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-cyan-400 px-4 py-3 font-bold text-slate-950 hover:bg-cyan-300 disabled:opacity-50">
         <Send size={17}/>{busy?"Zapisuję…":"Zleć agentowi"}
        </button>
        {!agent.enabled&&<p className="text-xs text-amber-200">Agent jest wyłączony. Włącz go w centrum agentów.</p>}
       </form>
      </section>
      <section className="min-w-0 rounded-3xl border border-white/10 bg-white/[.045] p-4 sm:p-6">
       <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-bold">{sales?"Sprawy sprzedażowe":"Zlecenia i wyniki"}</h2>
        <button type="button" disabled={loading} onClick={()=>setRefresh(v=>v+1)}
         className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/20 px-3 text-sm hover:bg-white/10">
         <RefreshCw size={16}/> Odśwież
        </button>
       </div>
       <p className="mt-2 text-xs text-slate-400">Wyniki są szkicami do zatwierdzenia, a nie potwierdzeniem wysyłki lub kontaktu z klientem.</p>
       {tasks.length===0?<div className="mt-6 rounded-2xl border border-dashed border-white/15 p-7 text-center text-sm text-slate-400">
        Nie ma jeszcze zleceń. Dodaj pierwsze polecenie po lewej stronie.
       </div>:
        <div className="mt-5 max-h-[900px] space-y-3 overflow-y-auto pr-1">
         {tasks.map(t=><article key={t.id} className="min-w-0 overflow-hidden rounded-2xl border border-white/10 bg-[#101e37] p-4">
           <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
             <span className="inline-flex items-center gap-1"><Clock3 size={13}/>{fmt(t.createdAt)}</span>
             <span className={t.status==="DONE"?"text-emerald-300":t.status==="ERROR"?"text-rose-300":"text-cyan-200"}>
               {t.status==="DONE"?"Opracowano":t.status==="ERROR"?"Błąd":t.status==="IN_PROGRESS"?"Agent pracuje":"W kolejce"}
             </span>
           </div>
           <h3 className="mt-3 break-words text-sm font-bold leading-6 text-white">{t.title}</h3>
           {(t.metadata?.client||t.metadata?.project)&&<p className="mt-2 break-words text-xs text-slate-400">
             {[t.metadata?.client,t.metadata?.project].filter(Boolean).join(" · ")}
           </p>}
           {sales&&<label className="mt-3 block text-xs text-slate-300">Etap w CRM
             <select disabled={busy} value={t.metadata?.stage||"NEW"} onChange={e=>updateStage(t.id,e.target.value)}
               className="mt-1 block w-full rounded-xl border border-white/20 bg-[#172b47] px-3 py-2 text-sm text-white">
               {STAGES.map(([v,l])=><option key={v} value={v}>{l}</option>)}
             </select>
           </label>}
           {Array.isArray(t.metadata?.conversation)&&t.metadata.conversation.length>0?
            <div className="mt-4 min-w-0 rounded-xl border border-cyan-400/10 bg-[#0b1830] p-3 sm:p-4">
             <h4 className="text-xs font-bold uppercase tracking-wider text-cyan-200">Rozmowa z agentem</h4>
             <div className="mt-3 max-h-[550px] space-y-3 overflow-y-auto pr-1">
              {t.metadata.conversation.map((m,index)=><div key={index}
               className={"min-w-0 rounded-xl border p-3 text-sm leading-6 "+(m.role==="user"
                 ?"ml-3 border-violet-400/20 bg-violet-500/10 text-slate-100"
                 :"mr-3 border-cyan-400/15 bg-cyan-400/[.045] text-slate-200")}>
               <p className="mb-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                {m.role==="user"?"Twoja wiadomość":agent.name}
               </p>
               <p className="whitespace-pre-wrap break-words">{m.content}</p>
              </div>)}
             </div>
             {t.metadata.result&&<button type="button"
               onClick={()=>navigator.clipboard.writeText(t.metadata.result)}
               className="mt-3 inline-flex min-h-9 items-center gap-2 rounded-lg border border-white/10 px-3 text-xs text-slate-300 hover:bg-white/10">
               <Clipboard size={14}/> Kopiuj ostatni wynik
              </button>}
            </div>:
            t.metadata?.result&&<div className="mt-4 min-w-0 rounded-xl border border-cyan-400/10 bg-[#0b1830] p-4">
             <div className="flex items-center justify-between gap-3">
               <h4 className="text-xs font-bold uppercase tracking-wider text-cyan-200">Wynik agenta</h4>
               <button type="button" onClick={()=>navigator.clipboard.writeText(t.metadata.result)} title="Kopiuj"
                 className="inline-flex min-h-9 items-center gap-1 rounded-lg px-2 text-xs text-slate-300 hover:bg-white/10"><Clipboard size={15}/> Kopiuj</button>
             </div>
             <p className="mt-3 max-h-96 overflow-y-auto whitespace-pre-wrap break-words text-sm leading-6 text-slate-200">{t.metadata.result}</p>
            </div>}
           {["DONE","ERROR"].includes(t.status) &&
            <form onSubmit={event=>sendReply(event,t)} className="mt-4 min-w-0 border-t border-white/10 pt-4">
             <label className="block text-xs font-bold text-cyan-200">Odpowiedz agentowi — kontynuuj tę sprawę
               <textarea rows={3} maxLength={5000}
                 value={replyDrafts[t.id]||""}
                 onChange={event=>setReplyDrafts(prev=>({...prev,[t.id]:event.target.value}))}
                 placeholder={sales
                   ?"Wpisz odpowiedzi na pytania agenta, dodatkowe informacje lub poproś o poprawienie oferty…"
                   :"Odpowiedz na pytanie lub doprecyzuj zlecenie…"}
                 className="mt-2 block w-full min-w-0 resize-y rounded-xl border border-cyan-300/20 bg-[#111f38] p-3 text-sm leading-6 text-white placeholder:text-slate-500"
               />
             </label>
             <button type="submit" disabled={!!replyBusy||!agent.enabled||!(replyDrafts[t.id]||"").trim()}
               className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-violet-500 px-4 text-sm font-bold text-white hover:bg-violet-400 disabled:opacity-40 sm:w-auto">
               <Send size={15}/> {replyBusy===t.id?"Przekazuję…":"Wyślij odpowiedź agentowi"}
             </button>
            </form>}
           {["TODO","IN_PROGRESS"].includes(t.status) &&
             <p className="mt-3 rounded-lg border border-cyan-400/10 bg-cyan-400/5 p-3 text-xs text-cyan-200">
               {t.status==="IN_PROGRESS"?"Agent opracowuje kolejną odpowiedź…":
                 "Odpowiedź jest w kolejce. Wynik pojawi się w tej rozmowie."}
             </p>}
           {t.metadata?.error&&<p role="alert" className="mt-3 text-xs text-rose-300">{t.metadata.error}</p>}
         </article>)}
        </div>}
      </section>
     </div>
     {notice&&<p role="status" className="mt-5 rounded-xl border border-emerald-400/25 bg-emerald-400/10 p-4 text-sm text-emerald-200">{notice}</p>}
     {error&&<p role="alert" className="mt-5 rounded-xl border border-rose-400/25 bg-rose-400/10 p-4 text-sm text-rose-200">{error}</p>}
    </>}
  </div>
 </main>;
}
