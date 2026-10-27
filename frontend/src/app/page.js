"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { Activity, ArrowUpRight, Bot, CheckCircle2, Clock3, FileText, Mic, ShieldCheck, Sparkles, Workflow } from "lucide-react";
import Navbar from "./components/Navbar";
import UserMenu from "./components/UserMenu";
import FileUpload from "./components/FileUpload";
import { getExecutiveDashboard } from "@/lib/api";

const agents = [
  { name: "Executive", status: "Podstawowa wersja", phase: "existing", icon: "🧠" },
  { name: "Document", status: "Wymaga testów", phase: "existing", icon: "📄" },
  { name: "Meeting", status: "Wymaga testów", phase: "existing", icon: "🎙️" },
  { name: "General", status: "Podstawowa wersja", phase: "existing", icon: "✨" },
  { name: "Financial", status: "W rozwoju", phase: "building", icon: "📊" },
  { name: "KSeF", status: "W rozwoju", phase: "building", icon: "🧾" },
  { name: "Mail", status: "W rozwoju", phase: "building", icon: "✉️" },
  { name: "Personal Assistant", status: "Zaplanowany", phase: "planned", icon: "🤝" },
  { name: "Task Manager", status: "Zaplanowany", phase: "planned", icon: "✅" },
  { name: "Communication", status: "Zaplanowany", phase: "planned", icon: "💬" },
  { name: "Offer", status: "Zaplanowany", phase: "planned", icon: "📋" },
  { name: "Construction", status: "Zaplanowany", phase: "planned", icon: "🏗️" },
  { name: "Investment", status: "Zaplanowany", phase: "planned", icon: "🏙️" },
  { name: "Sales", status: "Zaplanowany", phase: "planned", icon: "📈" },
  { name: "Research", status: "Zaplanowany", phase: "planned", icon: "🔎" },
  { name: "Secretary", status: "Zaplanowany", phase: "planned", icon: "📞" },
  { name: "Legal", status: "Zaplanowany", phase: "planned", icon: "⚖️" },
  { name: "Shopping", status: "Zaplanowany", phase: "planned", icon: "🛒" },
  { name: "Trading", status: "Zaplanowany", phase: "planned", icon: "📉" }
];
const statusStyle = {
  existing: "border-emerald-400/30 bg-emerald-400/10 text-emerald-300",
  building: "border-amber-400/30 bg-amber-400/10 text-amber-300",
  planned: "border-slate-400/20 bg-slate-400/10 text-slate-300"
};
const quickLinks = [
  { href: "/document", title: "Dokumenty", icon: FileText },
  { href: "/meeting", title: "Spotkania", icon: Mic },
  { href: "/tasks", title: "Zadania", icon: CheckCircle2 },
  { href: "/history", title: "Historia", icon: Clock3 }
];

export default function HomePage() {
  const [dashboard, setDashboard] = useState(null);
  const [loadError, setLoadError] = useState(false);
  const reducedMotion = useReducedMotion();
  useEffect(() => {
    let active = true;
    getExecutiveDashboard()
      .then(data => { if (active) setDashboard(data?.dashboard || null); })
      .catch(() => { if (active) setLoadError(true); });
    return () => { active = false; };
  }, []);

  const summary = dashboard?.summary || {};
  const stats = [
    ["Otwarte zadania", summary.openTasks ?? "—"],
    ["Wykonane", summary.completedTasks ?? "—"],
    ["Priorytetowe", summary.highPriorityTasks ?? "—"],
    ["Po terminie", summary.overdueTasks ?? "—"],
    ["Dokumenty", summary.documents ?? "—"],
    ["Spotkania", summary.meetings ?? "—"]
  ];
  const animate = reducedMotion ? {} : { initial: { opacity: 0, y: 18 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.5 } };

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#070e22] text-slate-100">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(ellipse 60% 35% at 50% 0%, rgba(37,99,235,.26), transparent), radial-gradient(ellipse 35% 30% at 95% 40%, rgba(6,182,212,.09), transparent)" }} />
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-[.07]" style={{ backgroundImage: "linear-gradient(#60a5fa 1px, transparent 1px),linear-gradient(90deg,#60a5fa 1px,transparent 1px)", backgroundSize: "52px 52px" }} />
      <div className="relative mx-auto max-w-7xl px-4 py-6 sm:px-8 sm:py-10">
        <div className="rounded-2xl border border-white/10 bg-slate-950/50 px-4 py-3 backdrop-blur-xl sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-3"><span className="flex items-center gap-2 text-lg font-black tracking-tight"><Bot className="text-cyan-300" /> Przem<span className="text-cyan-300">AI</span></span><UserMenu /></div>
        </div>
        <div className="mt-7 grid gap-6 lg:grid-cols-[190px_minmax(0,1fr)]"><aside className="hidden self-start rounded-2xl border border-white/10 bg-slate-950/50 p-3 backdrop-blur-xl lg:sticky lg:top-6 lg:block"><p className="mb-3 px-3 text-[10px] font-bold uppercase tracking-widest text-slate-500">Nawigacja</p><Navbar vertical /></aside><div className="min-w-0"><div className="lg:hidden"><Navbar /></div><motion.section {...animate} className="relative mt-7 overflow-hidden rounded-3xl border border-blue-400/20 bg-gradient-to-br from-[#102b65] via-[#101b3e] to-[#0b142d] p-7 shadow-[0_18px_90px_rgba(13,90,220,.16)] sm:p-11">
          <div aria-hidden="true" className="absolute -right-20 -top-24 h-80 w-80 rounded-full bg-blue-500/20 blur-3xl" />
          <div className="relative max-w-3xl">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-xs font-semibold text-cyan-200"><Sparkles size={14}/> CENTRUM DOWODZENIA</div>
            <h1 className="text-3xl font-black tracking-tight sm:text-5xl">Twój świat pracy.<br/><span className="bg-gradient-to-r from-cyan-300 to-blue-400 bg-clip-text text-transparent">Jeden inteligentny system.</span></h1>
            <p className="mt-5 max-w-2xl text-sm leading-7 text-blue-100/75 sm:text-base">Agenci, dokumenty, spotkania i zadania w jednym miejscu. Budujemy osobistego asystenta, który połączy informacje z całej firmy.</p>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Link href="/document" className="inline-flex items-center gap-2 rounded-xl bg-cyan-400 px-5 py-3 text-sm font-bold text-slate-950 transition hover:bg-cyan-300">Analizuj dokument <ArrowUpRight size={17}/></Link>
              <Link href="/meeting" className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/20">Przeanalizuj spotkanie</Link>
            </div>
          </div>
        </motion.section>
        <section className="mt-8">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2"><h2 className="flex items-center gap-2 text-xl font-bold"><Activity className="text-cyan-300" /> Pulpit operacyjny</h2><span className="text-xs text-slate-400">{loadError ? "Dane chwilowo niedostępne" : dashboard ? "Dane z systemu" : "Ładowanie danych…"}</span></div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">{stats.map(([label,value]) => <div key={label} className="rounded-2xl border border-white/10 bg-white/[.045] p-4 backdrop-blur-md"><div className="text-2xl font-bold tabular-nums text-white">{value}</div><div className="mt-2 text-xs text-slate-400">{label}</div></div>)}</div>
        </section>
        <section className="mt-9 grid gap-5 lg:grid-cols-[1.4fr_1fr]">
          <div className="rounded-3xl border border-white/10 bg-white/[.045] p-6"><h2 className="mb-4 flex items-center gap-2 text-xl font-bold"><Bot className="text-blue-300" /> Executive Briefing</h2><p className="whitespace-pre-wrap text-sm leading-7 text-slate-300">{dashboard?.briefing || (loadError ? "Nie udało się pobrać briefingu. Spróbuj ponownie później." : "Przygotowujemy Twój briefing…")}</p></div>
          <div className="rounded-3xl border border-white/10 bg-white/[.045] p-6"><h2 className="mb-4 flex items-center gap-2 text-xl font-bold"><Workflow className="text-cyan-300"/> Szybki dostęp</h2><div className="grid grid-cols-2 gap-3">{quickLinks.map(({href,title,icon:Icon}) => <Link key={href} href={href} className="group rounded-xl border border-white/10 bg-slate-900/60 p-4 transition hover:-translate-y-1 hover:border-cyan-400/40 hover:bg-blue-500/10"><Icon className="mb-3 text-cyan-300" size={23}/><span className="flex items-center justify-between text-sm font-semibold">{title}<ArrowUpRight size={15} className="opacity-50 transition group-hover:opacity-100"/></span></Link>)}</div></div>
        </section>
        <section className="mt-10">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-2xl font-bold">Ekosystem agentów</h2><p className="mt-1 text-sm text-slate-400">Stan implementacji — nie jest to wskaźnik gotowości produkcyjnej.</p></div><div className="flex items-center gap-2 text-xs text-slate-400"><ShieldCheck size={16} className="text-cyan-300"/> 19 modułów w planie</div></div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{agents.map((agent,index) => <motion.div key={agent.name} initial={reducedMotion ? false : {opacity:0,y:12}} whileInView={{opacity:1,y:0}} viewport={{once:true,amount:.1}} transition={{duration:.35,delay:reducedMotion ? 0 : Math.min(index,7)*.04}} className="group rounded-2xl border border-white/10 bg-gradient-to-br from-white/[.075] to-white/[.025] p-5 transition hover:-translate-y-1 hover:border-cyan-400/40 hover:shadow-[0_10px_40px_rgba(6,182,212,.08)]"><div className="flex items-center justify-between"><span className="text-2xl" aria-hidden="true">{agent.icon}</span><span className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold ${statusStyle[agent.phase]}`}>{agent.status}</span></div><h3 className="mt-5 text-base font-bold">{agent.name}</h3><p className="mt-1 text-xs text-slate-400">{agent.phase === "existing" ? "Podstawowa implementacja" : agent.phase === "building" ? "Trwają prace" : "Do wdrożenia"}</p></motion.div>)}</div>
        </section>
        <section className="mt-9 rounded-3xl border border-white/10 bg-white/[.04] p-6"><h2 className="mb-3 text-lg font-bold">Prześlij plik do analizy</h2><div className="rounded-xl bg-white p-3 text-slate-900"><FileUpload /></div></section>
        <footer className="py-8 text-center text-xs text-slate-500">PrzemAI · Panel rozwojowy · Statusy agentów oznaczają etap wdrożenia</footer></div></div>
      </div>
    </main>
  );
}
