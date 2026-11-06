"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Building2, Globe2, ShieldCheck } from "lucide-react";
import Navbar from "../../components/Navbar";
import UserMenu from "../../components/UserMenu";
import { createOrganization, getOrganizations } from "@/lib/api";

export default function CompanySetupPage() {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [companies, setCompanies] = useState([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getOrganizations().then(response => {
      if (response?.success === true && Array.isArray(response.data)) setCompanies(response.data);
    }).catch(() => {});
  }, []);

  async function create(event) {
    event.preventDefault();
    if (loading) return;
    setError("");
    setNotice("");
    setLoading(true);
    try {
      const response = await createOrganization({ name, slug });
      if (response?.success !== true || !response?.data?.id) throw new Error("Brak potwierdzenia utworzenia firmy.");
      setCompanies(current => [...current, { ...response.data, role: "OWNER", domains: [] }]);
      setName("");
      setSlug("");
      setNotice("Konto firmy zostało utworzone. Konfiguracja logo, domeny oraz dostępów zostanie udostępniona po weryfikacji.");
    } catch (err) {
      setError(err?.message || "Nie udało się utworzyć konta firmy.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#070e22] px-4 py-6 text-slate-100 sm:px-8">
      <div className="mx-auto max-w-5xl">
        <header className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-[#111c35]/[.04] px-5 py-4">
          <Link href="/" className="text-lg font-black">Przem<span className="text-violet-300">AI</span></Link>
          <UserMenu />
        </header>
        <Navbar />
        <div className="mb-8">
          <span className="inline-flex items-center gap-2 rounded-full border border-violet-400/25 bg-violet-400/10 px-3 py-1 text-xs font-bold text-violet-200"><Building2 size={15} /> PRZEMAI FOR BUSINESS</span>
          <h1 className="mt-4 text-3xl font-black sm:text-4xl">Konto firmowe</h1>
          <p className="mt-3 text-sm leading-7 text-slate-300">Zarejestruj firmę w swoim koncie PrzemAI. Własna domena, logo i współdzielenie danych będą aktywowane dopiero po odpowiedniej weryfikacji i konfiguracji uprawnień.</p>
        </div>
        <div className="grid gap-6 lg:grid-cols-[1.15fr_1fr]">
          <form onSubmit={create} className="space-y-5 rounded-3xl border border-white/10 bg-gradient-to-br from-[#14274c] to-[#0b152c] p-6">
            <h2 className="text-xl font-bold">Załóż przestrzeń firmy</h2>
            <div><label htmlFor="company-name" className="mb-2 block text-sm font-semibold">Nazwa firmy</label>
              <input id="company-name" required maxLength={120} value={name} onChange={event => setName(event.target.value)} placeholder="Np. Dekonica" className="w-full rounded-xl border border-white/15 bg-slate-950/60 px-4 py-3 text-white outline-none focus:border-violet-400" /></div>
            <div><label htmlFor="company-slug" className="mb-2 block text-sm font-semibold">Identyfikator firmy</label>
              <input id="company-slug" required minLength={3} maxLength={40} pattern="[a-z0-9][a-z0-9-]{1,38}[a-z0-9]" value={slug} onChange={event => setSlug(event.target.value.toLowerCase())} placeholder="np. dekonica" className="w-full rounded-xl border border-white/15 bg-slate-950/60 px-4 py-3 text-white outline-none focus:border-violet-400" />
              <p className="mt-2 text-xs text-slate-400">Małe litery, cyfry i łączniki. Ten identyfikator musi być unikalny.</p></div>
            {error && <p role="alert" className="rounded-xl border border-rose-400/25 bg-rose-400/10 px-4 py-3 text-sm text-rose-200">{error}</p>}
            {notice && <p role="status" className="rounded-xl border border-violet-400/25 bg-violet-400/10 px-4 py-3 text-sm text-violet-100">{notice}</p>}
            <button disabled={loading} type="submit" className="w-full rounded-xl bg-violet-400 px-5 py-3.5 font-bold text-slate-950 hover:bg-violet-300 disabled:opacity-50">{loading ? "Tworzenie…" : "Utwórz konto firmowe"}</button>
          </form>
          <div className="space-y-5">
            <section className="rounded-3xl border border-white/10 bg-[#111c35]/[.045] p-6">
              <h2 className="flex items-center gap-2 text-lg font-bold"><Globe2 size={21} className="text-violet-300" /> Własna domena i logo</h2>
              <p className="mt-3 text-sm leading-7 text-slate-300">Przykładowo <strong>api.dekonica.com</strong> z logo Dekonica. Podłączenie domeny wymaga potwierdzenia prawa do jej używania (rekord DNS) i konfiguracji SSL. Samo utworzenie firmy nie przekierowuje jeszcze domeny.</p>
            </section>
            <section className="rounded-3xl border border-white/10 bg-[#111c35]/[.045] p-6">
              <h2 className="flex items-center gap-2 text-lg font-bold"><ShieldCheck size={21} className="text-violet-300" /> Twoje przestrzenie</h2>
              {companies.length ? <div className="mt-4 space-y-3">{companies.map(company => <div key={company.id} className="rounded-xl border border-white/10 bg-[#111c35]/[.04] p-4"><p className="font-semibold">{company.displayName || company.name}</p><p className="mt-1 text-xs text-slate-400">{company.slug} · {company.role === "OWNER" ? "Właściciel" : "Członek"}</p></div>)}</div> : <p className="mt-3 text-sm text-slate-400">Brak utworzonych przestrzeni firmowych.</p>}
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}
