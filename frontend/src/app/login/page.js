"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Bot, LockKeyhole, ShieldCheck, Sparkles, MessageSquare, Workflow, FileText } from "lucide-react";
import { login } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const registrationEnabled = process.env.NEXT_PUBLIC_REGISTRATION_ENABLED !== "false";

  async function handleSubmit(event) {
    event.preventDefault();
    if (loading) return;
    setLoading(true);
    setError("");
    try {
      const data = await login(email.trim(), password);
      if (!data?.token) throw new Error("Nie udało się rozpocząć sesji.");
      localStorage.setItem("token", data.token);
      router.replace("/");
    } catch (err) {
      setError(err.message || "Nie udało się zalogować.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#070e22] px-4 py-10 text-slate-100">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(ellipse 55% 50% at 50% 20%, rgba(37,99,235,.26), transparent), radial-gradient(ellipse 30% 30% at 90% 90%, rgba(6,182,212,.12), transparent)" }} />
      <div className="relative grid w-full max-w-5xl gap-8 rounded-3xl border border-white/10 bg-[#101b39]/90 p-7 shadow-[0_20px_90px_rgba(0,0,0,.30)] backdrop-blur-xl sm:p-10 lg:grid-cols-2 lg:items-center">\n      <div className="hidden lg:block"><div aria-hidden="true" className="relative mx-auto mb-7 flex h-40 w-40 items-center justify-center"><div className="absolute inset-0 rounded-full bg-cyan-400/15 blur-3xl"/><div className="absolute inset-4 animate-pulse rounded-full border border-cyan-300/35 bg-gradient-to-br from-blue-500/30 via-cyan-300/10 to-indigo-500/30 shadow-[0_0_65px_rgba(34,211,238,.28)] motion-reduce:animate-none"/><div className="absolute inset-8 rounded-full border border-blue-200/25 bg-gradient-to-tr from-blue-700/60 to-cyan-400/30 shadow-inner"/><Bot size={42} className="relative text-cyan-100 drop-shadow-[0_0_12px_rgba(34,211,238,.8)]"/></div><span className="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-xs font-semibold text-cyan-200"><Sparkles size={14}/> TWOJE CENTRUM DOWODZENIA</span><h2 className="mt-6 text-5xl font-black leading-tight">Twoja firma.<br/><span className="bg-gradient-to-r from-cyan-300 to-blue-400 bg-clip-text text-transparent">Jeden inteligentny system.</span></h2><p className="mt-5 text-sm leading-7 text-slate-300">Zarządzaj dokumentami, spotkaniami i zadaniami z jednego miejsca. Rozwijamy osobistego asystenta AI dla każdego użytkownika.</p><div className="mt-8 grid gap-3">{[[MessageSquare,"Osobisty asystent"],[FileText,"Dokumenty i spotkania"],[Workflow,"Agenci i automatyzacje"]].map(([Icon,title])=><div key={title} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[.04] px-4 py-3 text-sm"><Icon className="text-cyan-300" size={20}/>{title}</div>)}</div></div><div>
        <div className="text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-cyan-400/20 bg-cyan-400/10 text-cyan-300"><Bot size={34}/></div>
          <h1 className="mt-5 text-4xl font-black tracking-tight">Przem<span className="text-cyan-300">AI</span></h1>
          <p className="mt-2 text-sm text-slate-400">Executive AI Workspace</p>
          <span className="mt-4 inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-xs text-cyan-200"><Sparkles size={13}/> Twoje centrum dowodzenia</span>
        </div>
        <form onSubmit={handleSubmit} className="mt-9 space-y-5">
          <div><label htmlFor="email" className="mb-2 block text-sm font-semibold text-slate-200">E-mail</label><input id="email" name="email" type="email" autoComplete="username" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="twoj@email.pl" className="w-full rounded-xl border border-white/15 bg-slate-950/50 px-4 py-3.5 text-white outline-none placeholder:text-slate-500 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20"/></div>
          <div><label htmlFor="password" className="mb-2 block text-sm font-semibold text-slate-200">Hasło</label><input id="password" name="password" type="password" autoComplete="current-password" required value={password} onChange={e=>setPassword(e.target.value)} className="w-full rounded-xl border border-white/15 bg-slate-950/50 px-4 py-3.5 text-white outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20"/></div>
          {error && <p role="alert" className="rounded-xl border border-red-400/25 bg-red-400/10 px-4 py-3 text-sm text-red-200">{error}</p>}
          <button type="submit" disabled={loading} className="flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-400 px-5 py-3.5 font-bold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-wait disabled:opacity-50">{loading ? "Logowanie…" : "Zaloguj się"}<ArrowRight size={17}/></button>
        </form>
        <div className="mt-7 flex flex-wrap items-center justify-center gap-4 text-sm text-slate-400">
          <Link href="/preview" className="inline-flex items-center gap-1 text-cyan-300 hover:text-cyan-200">Zobacz podgląd <ArrowRight size={14}/></Link>
          {registrationEnabled && <Link href="/register" className="hover:text-white">Utwórz konto</Link>}
        </div>
        <div className="mt-7 flex items-center justify-center gap-2 border-t border-white/10 pt-6 text-xs text-slate-500"><ShieldCheck size={14}/><LockKeyhole size={14}/> Dostęp do danych wymaga autoryzacji</div>
      </div>
    </main>
  );
}
