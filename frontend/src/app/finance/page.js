"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowUpRight, FileText, Filter, Inbox, RefreshCw, Wallet, ShieldCheck } from "lucide-react";
import Navbar from "../components/Navbar";
import UserMenu from "../components/UserMenu";
import { getFinancialDocuments, getFinanceSummary } from "@/lib/api";

const STATUS_LABELS = {
  NEW: "Nowy — do weryfikacji",
  PROCESSED: "Przetworzony",
  VERIFIED: "Zweryfikowany",
  ERROR: "Wymaga uwagi",
  PAID: "Opłacony"
};

const SOURCE_LABELS = {
  MAIL: "Poczta",
  KSEF: "KSeF",
  MANUAL: "Ręcznie"
};

const PAGE_SIZE = 50;

const FILTER_STATUSES = [
  { value: "", label: "Wszystkie statusy" },
  { value: "NEW", label: "Nowe" },
  { value: "PROCESSED", label: "Przetworzone" },
  { value: "VERIFIED", label: "Zweryfikowane" },
  { value: "ERROR", label: "Wymagają uwagi" },
  { value: "PAID", label: "Opłacone" }
];

const FILTER_SOURCES = [
  { value: "", label: "Wszystkie źródła" },
  { value: "MAIL", label: "Poczta" },
  { value: "KSEF", label: "KSeF" },
  { value: "MANUAL", label: "Ręcznie" }
];

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString("pl-PL");
}

function formatMoney(amount, currency) {
  if (amount === null || amount === undefined || amount === "") return "—";
  const number = Number(amount);
  if (!Number.isFinite(number)) return "—";
  try {
    return new Intl.NumberFormat("pl-PL", {
      style: "currency",
      currency: currency || "PLN",
      maximumFractionDigits: 2
    }).format(number);
  } catch {
    return new Intl.NumberFormat("pl-PL", { maximumFractionDigits: 2 }).format(number);
  }
}

function StatCard({ label, value, icon: Icon, description }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[.055] p-5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-slate-300">{label}</p>
        <Icon size={19} className="text-cyan-300" aria-hidden="true" />
      </div>
      <p className="mt-4 text-3xl font-bold tabular-nums text-white">{value ?? "—"}</p>
      <p className="mt-2 text-xs text-slate-400">{description}</p>
    </div>
  );
}

export default function FinancePage() {
  const [items, setItems] = useState([]);
  const [summary, setSummary] = useState(null);
  const [status, setStatus] = useState("");
  const [source, setSource] = useState("");
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshedAt, setRefreshedAt] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const [documentsResponse, summaryResponse] = await Promise.all([
          getFinancialDocuments({ limit: PAGE_SIZE + 1, offset: page * PAGE_SIZE, status, source }),
          getFinanceSummary()
        ]);
        if (!active) return;
        const documents = Array.isArray(documentsResponse?.items) ? documentsResponse.items : [];
        setItems(documents.slice(0, PAGE_SIZE));
        setHasMore(documents.length > PAGE_SIZE);
        setSummary(summaryResponse?.data || null);
        setRefreshedAt(new Date());
      } catch (err) {
        if (!active) return;
        setError(err?.message || "Nie udało się pobrać danych finansowych.");
        setItems([]);
        setHasMore(false);
        setSummary(null);
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => { active = false; };
  }, [status, source, page, refreshKey]);

  return (
    <main className="min-h-screen bg-[#070e22] px-4 py-6 text-slate-100 sm:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/[.04] px-5 py-4">
          <Link href="/" className="inline-flex items-center gap-3 text-lg font-black">
            <ArrowLeft size={18} className="text-cyan-300" aria-hidden="true" /> Przem<span className="-ml-3 text-cyan-300">AI</span>
          </Link>
          <UserMenu />
        </header>
        <Navbar />
        <section className="mt-8">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-cyan-400/25 bg-cyan-400/10 px-3 py-1 text-xs font-bold text-cyan-200">
                <Wallet size={14} aria-hidden="true" /> FINANCIAL AGENT
              </span>
              <h1 className="mt-4 text-3xl font-black tracking-tight sm:text-4xl">Centrum finansów</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
                Dokumenty z poczty i KSeF, status weryfikacji oraz przypisanie do projektów.
                Import załącznika nie oznacza jeszcze odczytania ani zatwierdzenia faktury.
              </p>
            </div>
            <button type="button" onClick={() => setRefreshKey(key => key + 1)}
              disabled={loading}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-cyan-300/30 bg-cyan-300/10 px-5 py-3 text-sm font-bold text-cyan-100 transition hover:bg-cyan-300/20 disabled:opacity-50">
              <RefreshCw size={17} className={loading ? "animate-spin" : ""} aria-hidden="true" />
              Odśwież dane
            </button>
          </div>
          <div className="mt-7 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label="Wszystkie dokumenty" value={summary?.total} icon={FileText} description="Łącznie w systemie" />
            <StatCard label="Nowe" value={summary?.new} icon={Inbox} description="Do dalszej weryfikacji" />
            <StatCard label="Z poczty" value={summary?.mail} icon={Wallet} description="Załączniki e-mail" />
            <StatCard label="Z KSeF" value={summary?.ksef} icon={ShieldCheck} description="Dokumenty z integracji" />
          </div>
        </section>

        <section className="mt-8 overflow-hidden rounded-3xl border border-white/10 bg-white/[.045]">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 p-5 sm:p-6">
            <div>
              <h2 className="flex items-center gap-2 text-xl font-bold"><Filter size={20} className="text-cyan-300" aria-hidden="true" /> Rejestr dokumentów</h2>
              <p className="mt-2 text-xs text-slate-400">
                {loading ? "Ładowanie…" : error ? "Dane niedostępne" : "Strona " + (page + 1) + " · dokumenty: " + items.length}
                {refreshedAt && !loading && !error ? " · Aktualizacja: " + refreshedAt.toLocaleTimeString("pl-PL") : ""}
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <label className="text-xs text-slate-300">
                <span className="mb-1 block">Status</span>
                <select value={status} onChange={event => { setPage(0); setStatus(event.target.value); }}
                  className="min-h-11 rounded-xl border border-white/15 bg-[#101d3c] px-3 py-2 text-sm text-white outline-none focus:border-cyan-400">
                  {FILTER_STATUSES.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </label>
              <label className="text-xs text-slate-300">
                <span className="mb-1 block">Źródło</span>
                <select value={source} onChange={event => { setPage(0); setSource(event.target.value); }}
                  className="min-h-11 rounded-xl border border-white/15 bg-[#101d3c] px-3 py-2 text-sm text-white outline-none focus:border-cyan-400">
                  {FILTER_SOURCES.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </label>
            </div>
          </div>

          {error && <div role="alert" className="m-5 rounded-xl border border-rose-400/30 bg-rose-400/10 p-4 text-sm text-rose-200">{error}</div>}
          {loading ? (
            <div role="status" className="p-10 text-center text-slate-300">Pobieranie dokumentów finansowych…</div>
          ) : !error && items.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <Inbox size={42} className="mx-auto text-cyan-300" aria-hidden="true" />
              <h3 className="mt-4 text-lg font-bold">Brak dokumentów dla wybranych filtrów</h3>
              <p className="mt-2 text-sm text-slate-400">Sprawdź inne filtry lub status integracji w panelu agentów.</p>
              <Link href="/agents" className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-cyan-300 hover:text-cyan-200">Przejdź do agentów <ArrowUpRight size={16} /></Link>
            </div>
          ) : !error ? (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-white/10 bg-slate-950/30 text-xs uppercase tracking-wide text-slate-400">
                  <tr>
                    <th scope="col" className="whitespace-nowrap p-4">Data</th>
                    <th scope="col" className="p-4">Źródło</th>
                    <th scope="col" className="p-4">Dokument</th>
                    <th scope="col" className="p-4">Kontrahent</th>
                    <th scope="col" className="whitespace-nowrap p-4">Kwota brutto</th>
                    <th scope="col" className="p-4">Termin</th>
                    <th scope="col" className="p-4">Projekt</th>
                    <th scope="col" className="p-4">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map(item => (
                    <tr key={item.id} className="border-b border-white/[.07] transition hover:bg-white/[.035]">
                      <td className="whitespace-nowrap p-4 text-slate-300" title={item.source === "MAIL" ? (item.issueDate ? "Data z historycznego importu poczty — wymaga weryfikacji z fakturą" : "Data otrzymania e-mail, nie data wystawienia faktury") : "Data dokumentu"}>{formatDate(item.issueDate || (item.source === "MAIL" ? item.rawData?.receivedAt : null))}</td>
                      <td className="p-4"><span className="rounded-lg border border-blue-400/20 bg-blue-400/10 px-2.5 py-1 text-xs font-semibold text-blue-200">{SOURCE_LABELS[item.source] || item.source || "—"}</span></td>
                      <td className="max-w-64 break-words p-4 font-medium text-white">{item.invoiceNumber || item.ksefNumber || item.rawData?.filename || "—"}</td>
                      <td className="max-w-48 break-words p-4 text-slate-300">{item.sellerName || item.rawData?.from || "—"}</td>
                      <td className="whitespace-nowrap p-4 font-semibold text-white">{formatMoney(item.grossAmount, item.currency)}</td>
                      <td className="whitespace-nowrap p-4 text-slate-300">{formatDate(item.dueDate)}</td>
                      <td className="p-4 text-slate-300">{item.project?.name || "Nieprzypisany"}</td>
                      <td className="p-4"><span className={item.status === "ERROR" ? "rounded-lg border border-rose-400/25 bg-rose-400/10 px-2.5 py-1 text-xs text-rose-200" : item.status === "NEW" ? "rounded-lg border border-amber-400/25 bg-amber-400/10 px-2.5 py-1 text-xs text-amber-200" : "rounded-lg border border-emerald-400/25 bg-emerald-400/10 px-2.5 py-1 text-xs text-emerald-200"}>{STATUS_LABELS[item.status] || item.status || "—"}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {(page > 0 || hasMore) && <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 p-4"><p className="text-xs text-slate-400">Strona {page + 1} · pozycje {page * PAGE_SIZE + 1}–{page * PAGE_SIZE + items.length}</p><div className="flex gap-3"><button type="button" disabled={loading || page === 0} onClick={() => setPage(p => Math.max(0, p - 1))} className="min-h-11 rounded-xl border border-white/20 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">Poprzednia</button><button type="button" disabled={loading || !hasMore} onClick={() => setPage(p => p + 1)} className="min-h-11 rounded-xl border border-cyan-300/30 bg-cyan-300/10 px-4 py-2 text-sm font-semibold text-cyan-100 disabled:opacity-40">Następna</button></div></div>}
            </div>
          ) : null}
        </section>
        <footer className="py-8 text-center text-xs text-slate-500">PrzemAI · Dane dostępne wyłącznie po zalogowaniu · Bez automatycznych płatności</footer>
      </div>
    </main>
  );
}
