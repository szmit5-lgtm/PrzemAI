"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Bot, CheckCircle2, FileText, LockKeyhole, MessageSquare, ShieldCheck, Sparkles, Workflow } from "lucide-react";

const groups = [
  { title: "Podstawowa implementacja", color: "emerald", names: ["Executive", "Document", "Meeting", "General"] },
  { title: "W rozwoju", color: "amber", names: ["Financial", "KSeF", "Mail"] },
  { title: "W planie", color: "slate", names: ["Personal Assistant", "Task Manager", "Communication", "Offer", "Construction", "Investment", "Sales", "Research", "Secretary", "Legal", "Shopping", "Trading", "Commerce AI (Allegro)"] }
];
const colors = {
  emerald: "border-emerald-400/25 bg-emerald-400/10 text-emerald-300",
  amber: "border-amber-400/25 bg-amber-400/10 text-amber-300",
  slate: "border-slate-400/20 bg-slate-400/10 text-slate-300"
};

export default function PreviewPage() {
  const reduced = useReducedMotion();
  const registrationEnabled = process.env.NEXT_PUBLIC_REGISTRATION_ENABLED !== "false";
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#070e22] text-slate-100">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(ellipse 65% 40% at 45% 0%, rgba(37,99,235,.30), transparent), radial-gradient(ellipse 35% 40% at 100% 70%, rgba(6,182,212,.10), transparent)" }} />
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-[.06]" style={{ backgroundImage: "linear-gradient(#60a5fa 1px, transparent 1px),linear-gradient(90deg,#60a5fa 1px,transparent 1px)", backgroundSize: "50px 50px" }} />
      <div className="relative mx-auto max-w-7xl px-4 py-6 sm:px-8">
        <header className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-slate-950/40 px-5 py-4 backdrop-blur-lg">
          <div className="flex items-center gap-2 text-xl font-black"><Bot className="text-cyan-300" /> Przem<span className="text-cyan-300">AI</span></div>
          <div className="flex flex-wrap gap-2"><Link href="/login" className="rounded-xl border border-white/20 px-4 py-2 text-sm font-semibold hover:bg-white/10">Logowanie</Link>{registrationEnabled && <Link href="/register" className="rounded-xl bg-cyan-400 px-4 py-2 text-sm font-bold text-slate-950 hover:bg-cyan-300">Utwórz konto</Link>}</div>
        </header>
        <motion.section initial={reduced ? false : { opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .65 }} className="relative mt-7 overflow-hidden rounded-3xl border border-blue-400/20 bg-gradient-to-br from-[#122d67] via-[#101b3e] to-[#0b142d] p-7 sm:p-12">
          <div aria-hidden="true" className="absolute -right-16 -top-24 h-80 w-80 rounded-full bg-cyan-500/15 blur-3xl" />
          <div className="relative max-w-3xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-xs font-bold text-cyan-200"><Sparkles size={14}/> PODGLĄD NOWEGO INTERFEJSU</span>
            <h1 className="mt-6 text-4xl font-black leading-tight tracking-tight sm:text-6xl">Twoja firma.<br/><span className="bg-gradient-to-r from-cyan-300 to-blue-400 bg-clip-text text-transparent">Jeden inteligentny system.</span></h1>
            <p className="mt-5 max-w-xl text-base leading-8 text-blue-100/75">Asystenci, dokumenty, spotkania, finanse i zadania — jeden panel, wiele specjalizacji. Interfejs przygotowany na komputer i telefon.</p>
            <Link href="/login" className="mt-7 inline-flex items-center gap-2 rounded-xl bg-cyan-400 px-6 py-3 text-sm font-bold text-slate-950 transition hover:bg-cyan-300">Przejdź do aplikacji <ArrowRight size={17}/></Link>
          </div>
        </motion.section>
        <div className="mt-5 flex items-start gap-2 rounded-xl border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-xs leading-5 text-amber-100"><LockKeyhole className="mt-0.5 shrink-0" size={16}/><span>To publiczny podgląd wyglądu. Nie zawiera danych firmowych ani dostępu do agentów. Funkcje i integracje wymagają logowania, konfiguracji i testów.</span></div>
        <section className="mt-10">
          <h2 className="mb-5 text-2xl font-bold">Jedno centrum pracy</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[{icon:MessageSquare,title:"Osobisty asystent",text:"Jedna rozmowa, docelowo wiele kanałów."},{icon:FileText,title:"Dokumenty i spotkania",text:"Analizy, podsumowania i historia."},{icon:Workflow,title:"Finanse i agenci",text:"Wspólny panel procesów i integracji."},{icon:ShieldCheck,title:"Kontrola dostępu",text:"Dane firmowe tylko dla uprawnionych."}].map(({icon:Icon,title,text})=><div key={title} className="rounded-2xl border border-white/10 bg-white/[.055] p-5"><Icon className="text-cyan-300" size={25}/><h3 className="mt-4 font-bold">{title}</h3><p className="mt-2 text-sm leading-6 text-slate-400">{text}</p></div>)}
          </div>
        </section>
        <section className="mt-10">
          <h2 className="text-2xl font-bold">Ekosystem {groups.reduce((total, group) => total + group.names.length, 0)} modułów</h2>
          <p className="mt-2 text-sm text-slate-400">Etapy prac — nie są deklaracją gotowości produkcyjnej.</p>
          <div className="mt-6 grid gap-4 lg:grid-cols-3">{groups.map(group=><div key={group.title} className="rounded-2xl border border-white/10 bg-white/[.04] p-5"><span className={`rounded-full border px-3 py-1 text-xs font-bold ${colors[group.color]}`}>{group.title}</span><div className="mt-5 flex flex-wrap gap-2">{group.names.map(name=><span key={name} className="rounded-lg border border-white/10 bg-slate-900/70 px-3 py-2 text-sm text-slate-200">{name}</span>)}</div></div>)}</div>
        </section>
        <footer className="py-10 text-center text-xs text-slate-500"><CheckCircle2 className="mr-1 inline text-cyan-300" size={14}/> PrzemAI · Staging · Demonstracja interfejsu bez danych firmowych</footer>
      </div>
    </main>
  );
}
