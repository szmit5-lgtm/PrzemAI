"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

const API = "/api/agents/kaldeva";
async function call(path, options = {}) {
  const token = localStorage.getItem("token");
  if (!token) throw new Error("Zaloguj się, aby zlecić wyszukiwanie.");
  const response = await fetch(API + path, {
    ...options,
    headers: { Authorization: "Bearer " + token, ...(options.headers || {}) },
    cache: "no-store"
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || !data?.success) throw new Error(data?.error || "Błąd usługi (" + response.status + ").");
  return data.data;
}
export default function KaldevaPage() {
  const [query, setQuery] = useState("firmy montujące pompy ciepła Polska");
  const [job, setJob] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [id, setId] = useState("");
  const [history, setHistory] = useState([]);
  const [historyError, setHistoryError] = useState("");
  async function loadHistory() {
    try { const rows = await call("/jobs"); setHistory(Array.isArray(rows) ? rows : []); setHistoryError(""); }
    catch (e) { setHistoryError(e.message); }
  }
  useEffect(() => { loadHistory(); }, []);
  async function refresh(jobId = id) {
    if (!jobId) return;
    try {
      const result = await call("/jobs/" + encodeURIComponent(jobId));
      setJob(result);
      setError("");
      if (!["queued", "running"].includes(result?.status)) loadHistory();
    } catch (e) { setError(e.message); }
  }
  async function submit(e) {
    e.preventDefault();
    setBusy(true); setError(""); setJob(null); setId("");
    try {
      const created = await call("/discover", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: query.trim() })
      });
      setId(created.id);
      setJob({ id: created.id, status: created.status });
      loadHistory();
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }
  useEffect(() => {
    if (!id || !["queued", "running"].includes(job?.status)) return;
    const timer = setTimeout(() => refresh(id), 2500);
    return () => clearTimeout(timer);
  }, [id, job?.status]);
  const result = job?.result || job?.report || {};
  const leads = Array.isArray(result.accepted) ? result.accepted : null;
  return <main className="min-h-screen bg-[#080e20] p-4 text-slate-100 sm:p-8">
    <div className="mx-auto max-w-4xl">
      <Link href="/agents" className="text-cyan-300">← Centrum agentów</Link>
      <h1 className="mt-6 text-3xl font-bold">Kaldeva — wyszukiwanie klientów</h1>
      <p className="mt-3 text-sm text-slate-300">Wyszukujemy publiczne informacje o firmach, usuwamy duplikaty i przygotowujemy raport oraz szkice. Nie wysyłamy wiadomości. Zakończone raporty są zapisywane w historii konta. Zlecenia w toku mogą zostać przerwane przez restart serwera.</p>
      <form onSubmit={submit} className="mt-6 rounded-2xl border border-white/15 bg-white/5 p-5">
        <label htmlFor="query" className="block text-sm font-semibold">Kogo szukamy?</label>
        <textarea id="query" value={query} onChange={e => setQuery(e.target.value)} minLength={5} maxLength={200} rows={3} required className="mt-2 w-full rounded-xl border border-white/20 bg-slate-900 p-3 text-white"/>
        <button disabled={busy || query.trim().length < 5} className="mt-3 min-h-11 rounded-xl bg-cyan-300 px-5 font-bold text-slate-950 disabled:opacity-50">{busy ? "Przyjmowanie…" : "Zleć wyszukiwanie"}</button>
      </form>
      <section className="mt-6 rounded-2xl border border-white/15 bg-white/5 p-5">
        <div className="flex items-center justify-between gap-3"><h2 className="text-lg font-semibold">Ostatnie zlecenia</h2>
          <button type="button" onClick={loadHistory} className="min-h-10 rounded-lg border border-white/25 px-3 text-sm">Odśwież historię</button></div>
        {historyError && <p role="alert" className="mt-3 text-sm text-rose-200">{historyError}</p>}
        {history.length===0 && !historyError && <p className="mt-3 text-sm text-slate-400">Brak zapisanych zleceń.</p>}
        <div className="mt-3 space-y-2">{history.map(item=><button key={item.id} type="button" onClick={()=>{setId(item.id);setJob(item);setError("");}}
          className="flex min-h-12 w-full flex-wrap items-center justify-between gap-2 rounded-lg border border-white/15 px-3 py-2 text-left text-sm hover:bg-white/10">
          <span className="break-words">{item.query||item.id}</span><span className="text-cyan-200">{item.status||"—"}</span>
        </button>)}</div>
      </section>
      {error && <p role="alert" className="mt-4 rounded-xl border border-rose-400/40 p-4 text-rose-200">{error}</p>}
      {job && <section className="mt-6 rounded-2xl border border-white/15 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-semibold">Zlecenie: {job.status || "nieznany"}</h2>
          <button onClick={() => refresh()} className="min-h-11 rounded-lg border border-white/30 px-4">Odśwież</button>
        </div>
        <p className="mt-2 break-all text-xs text-slate-400">ID: {id}</p>
        {job.error && <p className="mt-3 text-rose-200">{String(job.error)}</p>}
        {["completed", "failed"].includes(job.status) && <div className="mt-5 space-y-4">
          <h3 className="font-semibold">Wynik zlecenia</h3>
          {leads ? <div className="space-y-4">
            <p className="text-sm text-slate-300">Przeanalizowano: {result.scanned ?? 0} · Kandydaci: {leads.length} · Odrzucone: {result.rejected?.length ?? 0}</p>
            <p className="text-xs text-amber-200">Publiczne wyniki wymagają weryfikacji. Szkice nie zostały wysłane.</p>
            {leads.length === 0 && <p>Nie znaleziono kandydatów. Spróbuj innego zapytania.</p>}
            {leads.map((lead, index) => <article key={lead.website || index} className="rounded-xl border border-white/15 bg-white/5 p-4">
              <h4 className="font-semibold">{lead.name || "Firma bez nazwy"}</h4>
              {lead.website && <a href={lead.website} target="_blank" rel="noopener noreferrer" className="mt-2 block break-all text-sm text-cyan-300 underline">{lead.website}</a>}
              {lead.category && <p className="mt-2 text-sm text-slate-300">{lead.category}</p>}
              <p className="mt-3 text-xs font-semibold text-slate-400">Szkic do zatwierdzenia</p>
              <p className="mt-1 whitespace-pre-wrap text-sm">{lead.draft || "Brak szkicu."}</p>
              {lead.draft && <button type="button" onClick={() => navigator.clipboard?.writeText(lead.draft)} className="mt-3 min-h-11 rounded-lg border border-white/30 px-4 text-sm">Kopiuj szkic</button>}
            </article>)}
          </div> : <pre className="max-h-[65vh] overflow-auto whitespace-pre-wrap break-words rounded-xl bg-slate-950 p-4 text-xs leading-6">{JSON.stringify(result, null, 2)}</pre>}
        </div>}
      </section>}
    </div>
  </main>;
}
