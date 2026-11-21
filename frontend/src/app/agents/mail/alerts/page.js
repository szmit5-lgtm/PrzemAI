"use client";
import {useEffect,useState} from "react";
import Link from "next/link";
import {ArrowLeft,Mail,RefreshCw,CheckCircle2,AlertTriangle,Clipboard} from "lucide-react";
import Navbar from "../../../components/Navbar";
import UserMenu from "../../../components/UserMenu";
import {getHomePlMailAlerts,getHomePlMailStatus,markHomePlMailAlertReviewed,setIntegrationEnabled} from "@/lib/api";

const label={PAYMENT_DEMAND:"Wezwanie do zapłaty",PAYMENT_REMINDER:"Przypomnienie o płatności",
 DEADLINE_OR_CONTRACT:"Pilny termin lub umowa"};
function date(value){
 if(!value)return "—";
 const d=new Date(value);
 return Number.isFinite(d.getTime())?d.toLocaleString("pl-PL"):"—";
}
export default function DekonicaMailAlertsPage(){
 const [items,setItems]=useState([]);
 const [mailStatus,setMailStatus]=useState(null);
 const [mailStatusError,setMailStatusError]=useState("");
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState("");
 const [notice,setNotice]=useState("");
 const [busy,setBusy]=useState("");
 const [refresh,setRefresh]=useState(0);
 useEffect(()=>{
  let active=true;setLoading(true);setError("");
  Promise.allSettled([getHomePlMailAlerts(),getHomePlMailStatus()]).then(([alerts,status])=>{
   if(!active)return;
   if(alerts.status==="fulfilled")setItems(Array.isArray(alerts.value?.data?.items)?alerts.value.data.items:[]);
   else setError(alerts.reason?.message||"Nie można odczytać alertów.");
   if(status.status==="fulfilled"){setMailStatus(status.value?.data||null);setMailStatusError("");}
   else{setMailStatus(null);setMailStatusError(status.reason?.message||"Brak danych synchronizacji.");}
  }).finally(()=>{if(active)setLoading(false);});
  return()=>{active=false;};
 },[refresh]);
 async function changeMonitoring(){
  if(busy||!mailStatus?.integrationId)return;
  const next=!mailStatus.enabled;
  if(next&&!window.confirm("Włączyć odczytywanie wiadomości office@dekonica.com i przygotowywanie lokalnych alertów? PrzemAI nie będzie wysyłać maili."))return;
  setBusy("mail-integration");setError("");setNotice("");
  try{
   await setIntegrationEnabled(mailStatus.integrationId,next);
   setNotice(next?"Włączono monitoring. Pierwszy odczyt zostanie zlecony agentowi finansowemu.":"Wyłączono monitoring poczty.");
   setRefresh(x=>x+1);
  }catch(err){setError(err?.message||"Nie udało się zmienić monitoringu poczty.");}
  finally{setBusy("");}
 }
 async function review(item){
  if(busy)return;setBusy(item.id);setNotice("");setError("");
  try{
   await markHomePlMailAlertReviewed(item.id);
   setItems(old=>old.map(a=>a.id===item.id?{...a,status:"REVIEWED"}:a));
   setNotice("Alert oznaczony jako przejrzany. Nie wysłano żadnego maila.");
  }catch(err){setError(err?.message||"Nie można oznaczyć alertu.");}
  finally{setBusy("");}
 }
 return <main className="min-h-screen min-w-0 overflow-x-clip bg-[#080e20] px-3 py-5 pb-24 text-slate-100 sm:px-6">
  <div className="mx-auto max-w-6xl">
   <header className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-[#111c35] p-4">
    <Link href="/agents/mail" className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-cyan-200">
     <ArrowLeft size={18}/> Agent Poczty
    </Link><UserMenu/>
   </header><Navbar/>
   <section className="mt-5 rounded-2xl border border-cyan-400/20 bg-gradient-to-r from-[#15364a] to-[#231a45] p-5 sm:p-7">
    <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-cyan-200"><Mail size={16}/> office@dekonica.com</p>
    <h1 className="mt-2 text-2xl font-black sm:text-3xl">Ważne wiadomości i szkice odpowiedzi</h1>
    <p className="mt-3 text-sm leading-6 text-slate-200">
     Alerty zapisane przez uprawnionego agenta, po wykryciu wezwań do zapłaty, ponagleń i ważnych terminów.
     Przygotowane teksty są wyłącznie propozycjami. <strong>PrzemAI niczego stąd nie wysyła.</strong>
    </p>
   </section>
   <section className="mt-5 rounded-2xl border border-white/10 bg-[#111c35] p-4 sm:p-5">
    <h2 className="font-bold">Stan synchronizacji HOME.PL</h2>
    {mailStatus?<div className="mt-3 space-y-2 text-sm text-slate-300">
     <p>Integracja: <strong className={mailStatus.enabled?"text-emerald-200":"text-amber-200"}>{
      mailStatus.state==="SYNCED"?"Ostatni odczyt zakończony":
      mailStatus.state==="AWAITING_FIRST_SYNC"?"Oczekiwanie na pierwszy odczyt":
      mailStatus.state==="AGENT_DISABLED"?"Agent finansowy wyłączony":
      mailStatus.state==="DISABLED"?"Monitoring wyłączony":
      mailStatus.state==="NOT_PROVISIONED"?"Integracja nieutworzona":"Wymaga konfiguracji"
     }</strong></p>
     <p>Ostatni udany odczyt: <strong>{date(mailStatus.lastSuccessfulSyncAt)}</strong></p>
     <p>Agent: {mailStatus.agentEnabled?"włączony":"wyłączony"} · następny cykl: {date(mailStatus.nextAgentRunAt)}</p>
     <p>Zapisane alerty: {mailStatus.savedAlerts}</p>
     {mailStatus.integrationId&&<button type="button" disabled={Boolean(busy)||mailStatus.state==="INVALID_CONFIGURATION"}
      onClick={changeMonitoring}
      className="mt-2 inline-flex min-h-11 items-center rounded-xl border border-cyan-400/30 bg-cyan-500/10 px-4 text-sm font-bold text-cyan-100 disabled:opacity-50">
      {busy==="mail-integration"?"Zapisuję…":mailStatus.enabled?"Wyłącz monitorowanie poczty":"Włącz monitorowanie poczty"}
     </button>}
     <p className="text-xs leading-5 text-slate-400">Odczyt jest ograniczony do najnowszych wiadomości. Data ostatniej synchronizacji nie jest potwierdzeniem przeczytania całej skrzynki. Żaden mail nie zostanie wysłany.</p>
    </div>:<p role="status" className="mt-3 text-sm text-amber-200">{mailStatusError||"Sprawdzam gotowość integracji…"}</p>}
   </section>
   <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
    <p className="text-sm text-slate-300">Nowe alerty: <strong>{items.filter(x=>x.status!=="REVIEWED").length}</strong></p>
    <button type="button" onClick={()=>setRefresh(x=>x+1)} disabled={loading}
     className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/15 px-4 text-sm font-bold disabled:opacity-50">
     <RefreshCw size={16}/> Odśwież
    </button>
   </div>
   {loading&&<p className="mt-4 text-sm text-slate-300">Pobieram zapisane alerty…</p>}
   {error&&<p role="alert" className="mt-4 rounded-xl border border-rose-400/30 bg-rose-500/10 p-4 text-sm text-rose-200">{error}</p>}
   {notice&&<p role="status" className="mt-4 rounded-xl border border-emerald-400/30 bg-emerald-500/10 p-4 text-sm text-emerald-200">{notice}</p>}
   {!loading&&!error&&items.length===0&&<p className="mt-4 rounded-xl border border-white/10 bg-[#111c35] p-5 text-sm text-slate-300">
    Nie zapisano jeszcze alertów. Nie oznacza to, że skrzynka została w całości przeskanowana: synchronizacja wymaga osobno aktywnej i uprawnionej integracji HOME.PL.
   </p>}
   <div className="mt-4 space-y-4">{items.map(item=><article key={item.id}
    className="min-w-0 rounded-2xl border border-white/10 bg-[#111c35] p-4 sm:p-6">
    <div className="flex flex-wrap items-start justify-between gap-2">
     <div className="min-w-0 flex-1">
      <p className="flex flex-wrap items-center gap-2 text-xs font-bold text-amber-200">
       <AlertTriangle size={16}/> {label[item.category]||"Ważna wiadomość"}
       {item.status==="REVIEWED"&&<span className="text-emerald-200">· Przejrzane</span>}
      </p>
      <h2 className="mt-2 break-words text-lg font-bold">{item.subject||"Bez tematu"}</h2>
      <p className="mt-2 break-words text-xs text-slate-300">Od: {item.from||"Brak nadawcy"} · {date(item.receivedAt)}</p>
     </div>
     {item.status!=="REVIEWED"&&<button type="button" disabled={Boolean(busy)} onClick={()=>review(item)}
      className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-emerald-400/25 bg-emerald-500/10 px-3 text-xs font-bold text-emerald-200 disabled:opacity-50">
      <CheckCircle2 size={16}/>{busy===item.id?"Zapisuję…":"Oznacz jako przejrzane"}
     </button>}
    </div>
    {item.preview&&<p className="mt-3 break-words rounded-lg border border-white/10 bg-white/[.035] p-3 text-sm text-slate-300">{item.preview}</p>}
    <h3 className="mt-4 flex items-center gap-2 text-sm font-bold"><Clipboard size={16}/> Roboczy szkic odpowiedzi</h3>
    <textarea rows={6} readOnly value={item.suggestedDraft||""}
     className="mt-2 w-full rounded-xl border border-white/15 bg-[#09162b] p-3 text-sm leading-6 text-slate-100"/>
    <p className="mt-2 text-xs text-slate-400">Szkic nie stanowi potwierdzenia zobowiązania ani terminu zapłaty. Przed wysyłką należy sprawdzić dokumenty.</p>
   </article>)}</div>
  </div>
 </main>;
}
