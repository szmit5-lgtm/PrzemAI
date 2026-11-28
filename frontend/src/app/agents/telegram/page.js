"use client";
import {useEffect,useState} from "react";
import Link from "next/link";
import {ArrowLeft,Copy,MessageCircle,ShieldCheck} from "lucide-react";
import Navbar from "../../components/Navbar";
import UserMenu from "../../components/UserMenu";
import {createTelegramLinkCode,getTelegramStatus} from "@/lib/api";

export default function TelegramPairingPage(){
  const [data,setData]=useState(null);
  const [error,setError]=useState("");
  const [loading,setLoading]=useState(false);
  const [status,setStatus]=useState(null);
  const [statusError,setStatusError]=useState("");
  const [check,setCheck]=useState(0);
  useEffect(()=>{
    const controller=new AbortController();
    setStatus(null);setStatusError("");
    getTelegramStatus(controller.signal).then(({data})=>{
      if(!["botConfigured","webhookSecretConfigured","automaticRegistrationEnabled","linked"].every(key=>typeof data?.[key]==="boolean"))
        throw Error("Nie udało się potwierdzić stanu Telegrama.");
      if(!controller.signal.aborted)setStatus(data);
    }).catch(error=>{
      if(!controller.signal.aborted)setStatusError(error.message||"Diagnostyka Telegrama jest niedostępna.");
    });
    return ()=>controller.abort();
  },[check]);
  const generate=async()=>{
    if(loading)return;
    setLoading(true);setError("");setData(null);
    try{
      const result=await createTelegramLinkCode();
      if(!result?.data?.code || !result?.data?.expiresAt)throw Error("Nie otrzymano kodu powiązania.");
      setData(result.data);
    }catch(e){setError(e.message||"Nie udało się przygotować kodu.");}
    finally{setLoading(false);}
  };
  const command=data?"/start "+data.code:"";
  return <main className="min-h-screen bg-[#080e20] px-3 py-5 text-slate-100 sm:px-6">
    <div className="mx-auto max-w-3xl">
      <header className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-[#111c35] p-4">
        <Link href="/agents" className="inline-flex items-center gap-2 text-sm font-semibold text-cyan-200"><ArrowLeft size={18}/> Wróć do agentów</Link><UserMenu/>
      </header>
      <Navbar/>
      <section className="mt-6 rounded-3xl border border-violet-400/25 bg-[#111c35] p-5 sm:p-8">
        <MessageCircle className="text-violet-300" size={32}/>
        <h1 className="mt-3 text-2xl font-black sm:text-3xl">Połącz Telegram z PrzemAI</h1>
        <p className="mt-3 text-sm leading-6 text-slate-300">
          Użyj istniejącego bota PrzemAI. Po aktywacji webhooka przez administratora
          bot będzie przyjmować zlecenia i pokazywać stan kolejki.
        </p>
        <section aria-labelledby="telegram-status" className="mt-5 rounded-2xl border border-white/10 p-4 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id="telegram-status" className="font-semibold">Diagnostyka Telegrama</h2>
            <button type="button" className="min-h-10 rounded-xl border border-white/20 px-3"
              onClick={()=>setCheck(value=>value+1)} disabled={!status&&!statusError}>Odśwież stan</button>
          </div>
          {!status&&!statusError&&<p role="status" className="mt-2 text-slate-300">Sprawdzanie konfiguracji…</p>}
          {statusError&&<p role="alert" className="mt-2 text-rose-200">{statusError}</p>}
          {status&&<>
            <dl className="mt-2 grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 text-slate-200">
              <dt>Konfiguracja bota</dt><dd>{status.botConfigured?"Jest":"Brak"}</dd>
              <dt>Klucz webhooka</dt><dd>{status.webhookSecretConfigured?"Jest":"Brak lub nieprawidłowy"}</dd>
              <dt>Automatyczna rejestracja webhooka</dt><dd>{status.automaticRegistrationEnabled?"Włączona":"Wyłączona"}</dd>
              <dt>Twoje ostatnie powiązanie</dt><dd>{status.linked?"Aktywne":"Brak aktywnego"}</dd>
            </dl>
            <p className="mt-2 text-xs text-slate-400">Po dostarczeniu wiadomości testowej przez bota można potwierdzić działanie webhooka.</p>
          </>}
        </section>
        <ol className="mt-5 list-decimal space-y-3 pl-5 text-sm leading-6 text-slate-200">
          <li>Naciśnij „Wygeneruj kod”. Kod jest jednorazowy i ważny 10 minut.</li>
          <li>Otwórz prywatny czat z dotychczasowym botem PrzemAI na Telegramie.</li>
          <li>Wyślij do bota poniższe polecenie w całości. Nie wysyłaj go nikomu innemu.</li>
        </ol>
        <button type="button" disabled={loading} onClick={generate}
          className="mt-6 min-h-11 rounded-xl bg-violet-400 px-5 py-3 font-bold text-slate-950 hover:bg-violet-300 disabled:opacity-50">
          {loading?"Tworzenie kodu…":"Wygeneruj kod"}
        </button>
        {error&&<p role="alert" className="mt-4 rounded-xl border border-rose-400/30 p-3 text-sm text-rose-200">{error}</p>}
        {data&&<div className="mt-5 rounded-2xl border border-cyan-400/25 bg-[#0b172c] p-4">
          <p className="text-xs font-bold uppercase tracking-widest text-cyan-200">Polecenie dla bota</p>
          <p className="mt-3 break-all rounded-xl bg-black/30 p-3 font-mono text-sm">{command}</p>
          <button type="button" onClick={()=>navigator.clipboard.writeText(command)}
            className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/20 px-4 text-sm font-semibold">
            <Copy size={16}/> Kopiuj polecenie
          </button>
          <p className="mt-3 text-xs text-slate-400">
            Ważny do: {new Date(data.expiresAt).toLocaleString("pl-PL")}
          </p>
        </div>}
        <p className="mt-6 flex gap-2 text-xs leading-5 text-slate-400">
          <ShieldCheck size={18} className="shrink-0"/>
          Połączenie wymaga zweryfikowanego webhooka i zalogowanego konta PrzemAI.
          W samym Telegramie nie wysyłaj haseł, tokenów ani numerów rachunków.
        </p>
      </section>
    </div>
  </main>;
}
