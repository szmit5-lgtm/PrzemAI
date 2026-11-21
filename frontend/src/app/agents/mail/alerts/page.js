"use client";
import {useEffect,useState} from "react";
import Link from "next/link";
import {ArrowLeft,Mail,RefreshCw,CheckCircle2,AlertTriangle,Clipboard} from "lucide-react";
import Navbar from "../../../components/Navbar";
import UserMenu from "../../../components/UserMenu";
import {getHomePlMailAlerts,markHomePlMailAlertReviewed} from "@/lib/api";

const label={PAYMENT_DEMAND:"Wezwanie do zapłaty",PAYMENT_REMINDER:"Przypomnienie o płatności",
 DEADLINE_OR_CONTRACT:"Pilny termin lub umowa"};
function date(value){
 if(!value)return "—";
 const d=new Date(value);
 return Number.isFinite(d.getTime())?d.toLocaleString("pl-PL"):"—";
}
export default function DekonicaMailAlertsPage(){
 const [items,setItems]=useState([]);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState("");
 const [notice,setNotice]=useState("");
 const [busy,setBusy]=useState("");
 const [refresh,setRefresh]=useState(0);
 useEffect(()=>{
  let active=true;setLoading(true);setError("");
  getHomePlMailAlerts().then(r=>{
   if(active)setItems(Array.isArray(r?.data?.items)?r.data.items:[]);
  }).catch(err=>{if(active)setError(err?.message||"Nie można odczytać alertów.");})
   .finally(()=>{if(active)setLoading(false);});
  return()=>{active=false;};
 },[refresh]);
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
