"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, FolderPlus, RefreshCw } from "lucide-react";
import { getFinanceProjects, createFinanceProject } from "@/lib/api";

export default function FinanceProjectsPage() {
  const [projects, setProjects] = useState([]);
  const [name, setName] = useState("");
  const [aliases, setAliases] = useState("");
  const [company, setCompany] = useState("Dekonica");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [pending, setPending] = useState(false);

  async function load() {
    try {
      const response = await getFinanceProjects();
      setProjects(Array.isArray(response.items) ? response.items : []);
    } catch(e) { setError(e.message || "Nie udało się pobrać projektów."); }
  }
  useEffect(() => { load(); }, []);

  async function save(event) {
    event.preventDefault();
    if (pending) return;
    setError(""); setNotice(""); setPending(true);
    try {
      await createFinanceProject({
        name, company,
        aliases: aliases.split(/[,;\n]/).map(x=>x.trim()).filter(Boolean)
      });
      setName(""); setAliases("");
      setNotice("Inwestycja została dodana. Agent wykorzysta jej nazwę i aliasy.");
      await load();
    } catch (e) { setError(e.message || "Nie udało się dodać inwestycji."); }
    finally { setPending(false); }
  }

  return <main className="min-h-screen min-w-0 overflow-x-clip bg-[#070e22] px-3 py-5 text-slate-100 sm:px-6 lg:px-9">
    <div className="mx-auto w-full min-w-0 max-w-4xl">
      <Link href="/finance" className="inline-flex items-center gap-2 text-sm text-cyan-300">
        <ArrowLeft size={17}/> Centrum finansów
      </Link>
      <h1 className="mt-8 break-words text-2xl font-black sm:text-3xl">Inwestycje i przypisywanie faktur</h1>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
        Wpisz nazwy i znane alternatywne określenia inwestycji. Agent przypisze fakturę
        automatycznie wyłącznie przy jednoznacznym dopasowaniu treści pozycji lub opisu.
        Faktury niejednoznaczne pozostają do ręcznej weryfikacji.
      </p>
      <form onSubmit={save} className="mt-7 space-y-4 rounded-3xl border border-white/10 bg-white/[.04] p-6">
        <h2 className="flex items-center gap-2 text-lg font-bold"><FolderPlus size={21}/> Dodaj inwestycję</h2>
        <label className="block text-sm">Nazwa inwestycji
          <input required minLength={3} maxLength={120} value={name} onChange={e=>setName(e.target.value)}
            placeholder="np. Zgorzelec" className="mt-1 block w-full rounded-xl border border-white/20 bg-[#101d3c] p-3"/>
        </label>
        <label className="block text-sm">Inne nazwy używane na fakturach (oddziel przecinkiem)
          <textarea value={aliases} onChange={e=>setAliases(e.target.value)} rows={2}
            placeholder="np. budowa Zgorzelec, inwestycja Zgorzelec"
            className="mt-1 block w-full rounded-xl border border-white/20 bg-[#101d3c] p-3"/>
        </label>
        <label className="block text-sm">Spółka
          <input value={company} onChange={e=>setCompany(e.target.value)} maxLength={100}
            className="mt-1 block w-full rounded-xl border border-white/20 bg-[#101d3c] p-3"/>
        </label>
        <button disabled={pending} className="rounded-xl bg-cyan-400 px-5 py-3 text-sm font-bold text-slate-950 disabled:opacity-50">
          {pending ? "Zapisuję..." : "Dodaj projekt"}
        </button>
        {error && <p role="alert" className="text-sm text-rose-300">{error}</p>}
        {notice && <p role="status" className="text-sm text-cyan-200">{notice}</p>}
      </form>
      <section className="mt-8 rounded-3xl border border-white/10 bg-white/[.04] p-6">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xl font-bold">Moje inwestycje ({projects.length})</h2>
          <button onClick={load} aria-label="Odśwież inwestycje"><RefreshCw size={18}/></button>
        </div>
        {projects.length ? <div className="mt-4 space-y-3">{projects.map(project=>
          <div key={project.id} className="min-w-0 overflow-hidden rounded-xl border border-white/10 p-4">
            <p className="font-bold">{project.name}</p>
            <p className="mt-1 break-words text-xs text-slate-400">{project.company || "Bez spółki"}
              {project.aliases?.length ? " · " + project.aliases.join(", ") : ""}
            </p>
          </div>)}</div>
          : <p className="mt-4 text-sm text-slate-300">Brak inwestycji — dodaj pierwszą, aby agent mógł przypisywać faktury.</p>}
      </section>
    </div>
  </main>;
}
