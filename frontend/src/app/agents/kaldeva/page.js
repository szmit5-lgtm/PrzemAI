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
  async function refresh(jobId = id) {
    if (!jobId) return;
    try {
      const result = await call("/jobs/" + encodeURIComponent(jobId));
      setJob(result);
      setError("");
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
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }
  useEffect(() => {
    if (!id || !["queued", "running"].includes(job?.status)) return;
    const timer = setTimeout(() => refresh(id), 2500);
    return () => clearTimeout(timer);
  }, [id, job?.status]);
  const result = job?.result || job?.report || {};
  return <main className="min-h-screen bg-[#080e20] p-4 text-slate-100 sm:p-8">
    <div className="mx-auto max-w-4xl">
      <Link href="/agents" className="text-cyan-300">← Centrum agentów</Link>
      <h1 className="mt-6 text-3xl font-bold">Kaldeva — wyszukiwanie klientów</h1>
      <p className="mt-3 text-sm text-slate-300">Wyszukujemy publiczne informacje o firmach, usuwamy duplikaty i przygotowujemy raport oraz szkice. Nie wysyłamy wiadomości. Wyniki są tymczasowe i mogą zniknąć po restarcie serwera.</p>
      <form onSubmit={submit} className="mt-6 rounded-2xl border border-white/15 bg-white/5 p-5">
        <label htmlFor="query" className="block text-sm font-semibold">Kogo szukamy?</label>
        <textarea id="query" value={query} onChange={e => setQuery(e.target.value)} minLength={5} maxLength={200} rows={3} required className="mt-2 w-full rounded-xl border border-white/20 bg-slate-900 p-3 text-white"/>
        <button disabled={busy || query.trim().length < 5} className="mt-3 min-h-11 rounded-xl bg-cyan-300 px-5 font-bold text-slate-950 disabled:opacity-50">{busy ? "Przyjmowanie…" : "Zleć wyszukiwanie"}</button>
      </form>
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
          <pre className="max-h-[65vh] overflow-auto whitespace-pre-wrap break-words rounded-xl bg-slate-950 p-4 text-xs leading-6">{JSON.stringify(result, null, 2)}</pre>
        </div>}
      </section>}
    </div>
  </main>;
}
