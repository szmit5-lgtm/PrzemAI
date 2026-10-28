"use client";

import Link from "next/link";
import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Bot, CheckCircle2, FileText, LockKeyhole, MessageSquare, ShieldCheck, Sparkles, Workflow, LayoutDashboard, Wallet, CheckSquare, Mic, Activity, ArrowUpRight } from "lucide-react";

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


const demoActions = [
  { title: "Porozmawiaj z asystentem", detail: "Zadaj pytanie po polsku", icon: MessageSquare },
  { title: "Prześlij dokument", detail: "Analiza dokumentów", icon: FileText },
  { title: "Moje zadania", detail: "Sprawdź, co jest do zrobienia", icon: CheckSquare },
  { title: "Finanse", detail: "Przegląd faktur i płatności", icon: Wallet }
];

function DashboardShowcase() {
  const [mode, setMode] = useState("advanced");
  return (
    <section id="dashboard-demo" aria-labelledby="dashboard-demo-title" className="mt-12 scroll-mt-8">
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <span className="text-xs font-bold uppercase tracking-[.25em] text-cyan-300">Podgląd interaktywny</span>
          <h2 id="dashboard-demo-title" className="mt-3 text-2xl font-black sm:text-3xl">Zobacz, jak będzie wyglądał pulpit</h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">Przełącz widok bez logowania. To wyłącznie demonstracja interfejsu — bez danych firmy, konta i aktywnych operacji.</p>
        </div>
        <div role="group" aria-label="Wybór widoku demonstracyjnego" className="inline-flex flex-wrap gap-1 rounded-2xl border border-white/15 bg-slate-950/70 p-1.5">
          <button type="button" aria-pressed={mode === "simple"} onClick={() => setMode("simple")} className={`min-h-11 rounded-xl px-4 py-2 text-sm font-bold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300 ${mode === "simple" ? "bg-cyan-400 text-slate-950" : "text-slate-200 hover:bg-white/10"}`}>Tryb prosty</button>
          <button type="button" aria-pressed={mode === "advanced"} onClick={() => setMode("advanced")} className={`min-h-11 rounded-xl px-4 py-2 text-sm font-bold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300 ${mode === "advanced" ? "bg-cyan-400 text-slate-950" : "text-slate-200 hover:bg-white/10"}`}>Zaawansowany</button>
        </div>
      </div>
      <div className="relative mt-6 overflow-hidden rounded-3xl border border-cyan-300/20 bg-[#0a1430] p-4 shadow-[0_22px_90px_rgba(14,116,230,.13)] sm:p-6">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-[.05]" style={{ backgroundImage: "linear-gradient(#60a5fa 1px,transparent 1px),linear-gradient(90deg,#60a5fa 1px,transparent 1px)", backgroundSize: "42px 42px" }} />
        <div className="relative flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4">
          <span className="flex items-center gap-2 text-lg font-black"><Bot size={21} className="text-cyan-300" /> Przem<span className="-ml-2 text-cyan-300">AI</span><span className="ml-2 rounded-full border border-amber-400/25 bg-amber-400/10 px-2 py-1 text-[10px] font-bold tracking-wider text-amber-200">DEMO</span></span>
          <span className="text-xs text-slate-400">{mode === "simple" ? "Duże przyciski · prostsza nawigacja" : "Pulpit · moduły i agenci"}</span>
        </div>
        {mode === "simple" ? (
          <div className="relative mx-auto max-w-3xl py-8 sm:py-12">
            <h3 className="text-3xl font-black leading-tight sm:text-4xl">W czym mogę Ci pomóc?</h3>
            <p className="mt-3 text-base leading-7 text-slate-300">Wybierz jedną z czterech czynności. Wszystkie przyciski są większe i czytelniejsze.</p>
            <div className="mt-7 grid gap-4 sm:grid-cols-2">
              {demoActions.map(({ title, detail, icon: Icon }, index) => (
                <div key={title} className={`flex min-h-36 items-center gap-4 rounded-3xl border p-5 sm:p-6 ${index === 0 ? "border-cyan-300/40 bg-gradient-to-r from-blue-700/60 to-cyan-700/30" : "border-white/15 bg-white/[.06]"}`}>
                  <Icon size={34} className="shrink-0 text-cyan-200" aria-hidden="true" />
                  <div><p className="text-lg font-bold sm:text-xl">{title}</p><p className="mt-1 text-sm text-slate-300">{detail}</p></div>
                  <ArrowUpRight size={19} className="ml-auto shrink-0 text-cyan-200" aria-hidden="true" />
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="relative mt-5 grid gap-5 lg:grid-cols-[180px_minmax(0,1fr)]">
            <aside aria-label="Przykładowa nawigacja" className="hidden rounded-2xl border border-white/10 bg-slate-950/40 p-3 lg:block">
              <p className="px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-slate-500">Menu</p>
              {[{ label: "Pulpit", icon: LayoutDashboard }, { label: "Asystent AI", icon: MessageSquare }, { label: "Agenci", icon: Bot }, { label: "Finanse", icon: Wallet }, { label: "Dokumenty", icon: FileText }, { label: "Spotkania", icon: Mic }, { label: "Zadania", icon: CheckSquare }].map(({ label, icon: Icon }, i) => (
                <div key={label} className={`mt-1 flex items-center gap-2 rounded-xl px-3 py-3 text-xs font-semibold ${i === 0 ? "bg-blue-600 text-white" : "text-slate-300"}`}><Icon size={16} aria-hidden="true" />{label}</div>
              ))}
            </aside>
            <div className="min-w-0">
              <div className="relative overflow-hidden rounded-2xl border border-blue-400/20 bg-gradient-to-br from-[#142e67] to-[#0c1935] p-6 sm:p-8">
                <div className="grid items-center gap-5 md:grid-cols-[1fr_190px]">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-[.25em] text-cyan-200">Centrum dowodzenia</span>
                    <h3 className="mt-3 text-2xl font-black sm:text-3xl">Twój osobisty asystent AI</h3>
                    <p className="mt-3 max-w-md text-sm leading-6 text-blue-100/80">Rozmowy, dokumenty, zadania i finanse w jednym miejscu. Jeden panel, wiele specjalizacji.</p>
                    <div className="mt-5 inline-flex items-center gap-2 rounded-xl border border-cyan-300/30 bg-cyan-300/10 px-4 py-3 text-sm font-semibold text-cyan-100"><MessageSquare size={16} aria-hidden="true" /> Rozpocznij rozmowę <ArrowRight size={16} aria-hidden="true" /></div>
                  </div>
                  <div aria-hidden="true" className="relative mx-auto flex h-40 w-40 items-center justify-center">
                    <div className="absolute inset-0 rounded-full bg-cyan-400/20 blur-3xl" />
                    <div className="absolute inset-3 animate-pulse rounded-full border border-cyan-300/35 bg-gradient-to-br from-blue-600/50 via-cyan-300/20 to-indigo-600/40 shadow-[0_0_65px_rgba(34,211,238,.24)] motion-reduce:animate-none" />
                    <div className="absolute inset-8 rounded-full border border-blue-200/30 bg-gradient-to-tr from-blue-700 to-cyan-500/50" />
                    <Bot size={44} className="relative text-cyan-100 drop-shadow-[0_0_12px_rgba(34,211,238,.7)]" />
                  </div>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[{ label: "Zadania", icon: CheckSquare }, { label: "Dokumenty", icon: FileText }, { label: "Finanse", icon: Wallet }, { label: "Agenci", icon: Activity }].map(({ label, icon: Icon }) => (
                  <div key={label} className="rounded-xl border border-white/10 bg-white/[.055] p-4"><Icon size={18} className="text-cyan-300" aria-hidden="true" /><p className="mt-3 text-xs text-slate-300">{label}</p><p className="mt-2 text-xl font-bold text-slate-500">—</p></div>
                ))}
              </div>
              <p className="mt-4 text-xs text-slate-500">Wartości „—” oznaczają brak rzeczywistych danych w podglądzie.</p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

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
            <div className="mt-7 flex flex-wrap gap-3"><Link href="/login" className="inline-flex items-center gap-2 rounded-xl bg-cyan-400 px-6 py-3 text-sm font-bold text-slate-950 transition hover:bg-cyan-300">Przejdź do aplikacji <ArrowRight size={17}/></Link><a href="#dashboard-demo" className="inline-flex items-center gap-2 rounded-xl border border-cyan-300/30 bg-cyan-300/10 px-6 py-3 text-sm font-bold text-cyan-100 transition hover:bg-cyan-300/20">Zobacz pulpit <ArrowRight size={17}/></a></div>
          </div>
        </motion.section>
        <div className="mt-5 flex items-start gap-2 rounded-xl border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-xs leading-5 text-amber-100"><LockKeyhole className="mt-0.5 shrink-0" size={16}/><span>To publiczny podgląd wyglądu. Nie zawiera danych firmowych ani dostępu do agentów. Funkcje i integracje wymagają logowania, konfiguracji i testów.</span></div>
        <section className="mt-10">
          <h2 className="mb-5 text-2xl font-bold">Jedno centrum pracy</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[{icon:MessageSquare,title:"Osobisty asystent",text:"Jedna rozmowa, docelowo wiele kanałów."},{icon:FileText,title:"Dokumenty i spotkania",text:"Analizy, podsumowania i historia."},{icon:Workflow,title:"Finanse i agenci",text:"Wspólny panel procesów i integracji."},{icon:ShieldCheck,title:"Kontrola dostępu",text:"Dane firmowe tylko dla uprawnionych."}].map(({icon:Icon,title,text})=><div key={title} className="rounded-2xl border border-white/10 bg-white/[.055] p-5"><Icon className="text-cyan-300" size={25}/><h3 className="mt-4 font-bold">{title}</h3><p className="mt-2 text-sm leading-6 text-slate-400">{text}</p></div>)}
          </div>
        </section>
        <DashboardShowcase />
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
