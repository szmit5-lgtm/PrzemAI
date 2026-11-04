"use client";

import AuthGuard from "../components/AuthGuard";
import Navbar from "../components/Navbar";
import UserMenu from "../components/UserMenu";
import FileUpload from "../components/FileUpload";
import { AudioLines, ShieldCheck } from "lucide-react";

export default function MeetingPage() {
  return (
    <AuthGuard>
      <main className="min-h-screen bg-[#070e22] px-4 py-6 text-slate-100 sm:px-8">
        <div className="mx-auto max-w-7xl">
          <header className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/[.04] px-5 py-4">
            <div className="text-lg font-black tracking-tight">Przem<span className="text-cyan-300">AI</span></div>
            <UserMenu />
          </header>
          <Navbar />
          <section className="mb-7">
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/25 bg-cyan-400/10 px-3 py-1 text-xs font-bold text-cyan-200"><AudioLines size={14} /> MEETING INTELLIGENCE</div>
            <h1 className="mt-4 text-3xl font-black sm:text-4xl">Spotkania</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">Prześlij nagranie spotkania, aby uzyskać podsumowanie, decyzje i ustalenia.</p>
          </section>
          <FileUpload mode="meeting" />
          <footer className="flex items-center justify-center gap-2 py-10 text-center text-xs text-slate-500"><ShieldCheck size={14} /> PrzemAI · Nagrania i wyniki tylko dla uprawnionego konta</footer>
        </div>
      </main>
    </AuthGuard>
  );
}
