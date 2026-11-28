"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import Navbar from "../components/Navbar";
import { getOrganizations, searchWorkspace } from "@/lib/api";

const labels = {
  history: "Historia",
  task: "Zadania osobiste",
  investment: "Inwestycja",
  companyDocument: "Biblioteka dokumentów spółki"
};

export default function SearchPage() {
  const [companies, setCompanies] = useState([]);
  const [companyError, setCompanyError] = useState("");
  const [organizationId, setOrganizationId] = useState("");
  const [query, setQuery] = useState("");
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    getOrganizations().then(({ data }) => {
      if (active) setCompanies(Array.isArray(data) ? data : []);
    }).catch(() => {
      if (active) setCompanyError("Lista spółek jest niedostępna. Odśwież stronę, by spróbować ponownie.");
    });
    return () => { active = false; };
  }, []);

  async function search(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setResult(null);
    try {
      setResult(await searchWorkspace(query.trim(), organizationId));
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#080e20] text-slate-100">
      <div className="mx-auto max-w-5xl px-4 pb-24 pt-5">
        <Navbar />
        <h1 className="mt-6 text-3xl font-bold">Wyszukiwanie</h1>
        <p className="mt-2 text-slate-300">Szukaj po nazwie w historii i zadaniach osobistych lub w zasobach wybranej spółki.</p>
        <form onSubmit={search} className="mt-6 grid gap-3 rounded-2xl border border-white/10 bg-[#111c35] p-4 sm:grid-cols-[1fr_auto]">
          <label className="grid gap-1">
            Szukana nazwa
            <input type="search" minLength={3} maxLength={100} required value={query} disabled={busy}
              onChange={event => setQuery(event.target.value)}
              className="min-w-0 rounded-lg border border-slate-500 bg-slate-950 px-3 py-2" />
          </label>
          <label className="grid gap-1">
            Zakres
            <select value={organizationId} disabled={busy} onChange={event => { setOrganizationId(event.target.value); setResult(null); setError(""); }}
              className="min-w-0 rounded-lg border border-slate-500 bg-slate-950 px-3 py-2">
              <option value="">Przestrzeń osobista</option>
              {companies.map(company => <option key={company.id} value={company.id}>{company.name}</option>)}
            </select>
          </label>
          <button disabled={busy || query.trim().length < 3}
            className="min-h-11 rounded-lg bg-violet-700 px-5 font-semibold disabled:opacity-50 sm:col-span-2 sm:justify-self-start">
            {busy ? "Wyszukiwanie…" : "Szukaj"}
          </button>
        </form>
        {companyError && <p role="status" className="mt-3 text-amber-200">{companyError}</p>}
        {error && <p role="alert" className="mt-5 text-rose-300">{error}</p>}
        {result && (
          <section className="mt-5" aria-label="Wyniki wyszukiwania">
            <p role="status" className="text-slate-300">
              {result.results.length ? `Wyniki: ${result.results.length}` : "Brak pasujących wyników."}
              {result.hasMore && " Zawęź frazę, aby zobaczyć pozostałe dopasowania."}
            </p>
            <ul className="mt-3 grid gap-2">
              {result.results.map(item => (
                <li key={`${item.kind}/${item.id}`}>
                  <Link href={item.href} className="block break-words rounded-xl border border-white/10 p-3 hover:bg-slate-800">
                    <span className="block text-sm text-slate-300">{labels[item.kind]}</span>
                    <span className="font-semibold">{item.title}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </main>
  );
}
