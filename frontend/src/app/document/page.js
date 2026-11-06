"use client";

import AuthGuard from "../components/AuthGuard";
import Navbar from "../components/Navbar";
import UserMenu from "../components/UserMenu";
import FileUpload from "../components/FileUpload";
import { FileText, ShieldCheck } from "lucide-react";

export default function DocumentPage() {
  return (
    <AuthGuard>
      <main className="min-h-screen min-w-0 overflow-x-clip bg-[#080e20] px-3 py-5 text-slate-100 sm:px-8">
        <div className="mx-auto w-full min-w-0 max-w-7xl">
          <header className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/[.04] px-5 py-4">
            <div className="text-lg font-black tracking-tight">Przem<span className="text-violet-300">AI</span></div>
            <UserMenu />
          </header>
          <Navbar />
          <section className="mb-7">
            <div className="inline-flex items-center gap-2 rounded-full border border-violet-400/25 bg-violet-400/10 px-3 py-1 text-xs font-bold text-violet-200"><FileText size={14} /> DOCUMENT INTELLIGENCE</div>
            <h1 className="mt-4 text-3xl font-black sm:text-4xl">Dokumenty</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">Analizuj dokumenty i otrzymuj czytelne podsumowania. Wyniki zapisywane są w historii analiz.</p>
          </section>
          <FileUpload mode="document" />
          <footer className="flex items-center justify-center gap-2 py-10 text-center text-xs text-slate-500"><ShieldCheck size={14} /> PrzemAI · Dokumenty dostępne wyłącznie dla uprawnionego konta</footer>
        </div>
      </main>
    </AuthGuard>
  );
}
