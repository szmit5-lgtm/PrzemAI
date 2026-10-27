"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Bot, LockKeyhole, ShieldCheck, Sparkles } from "lucide-react";
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
      <div className="relative w-full max-w-md rounded-3xl border border-white/10 bg-[#101b39]/90 p-7 shadow-[0_20px_90px_rgba(0,0,0,.30)] backdrop-blur-xl sm:p-10">
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
