"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowUpRight, FileText, Filter, Inbox, RefreshCw, Wallet, ShieldCheck } from "lucide-react";
import Navbar from "../components/Navbar";
import UserMenu from "../components/UserMenu";
import { getFinancialDocuments, getFinanceSummary, getProfile, queueKsefHistoryImport } from "@/lib/api";
import { parseFinanceDashboardResponses } from "@/lib/financeDashboardPayload";

const SOURCE_LABELS = {
  MAIL: "Poczta",
  KSEF: "KSeF",
  MANUAL: "Ręcznie"
};

const PAGE_SIZE = 50;

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
  const [source, setSource] = useState("");
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshedAt, setRefreshedAt] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [ownerId, setOwnerId] = useState("");
  const [importing, setImporting] = useState(false);
  const [importNotice, setImportNotice] = useState("");
  async function requestKsefImport() {
    if (importing) return;
    setImporting(true);
    setImportNotice("");
    try {
      const result = await queueKsefHistoryImport();
      setImportNotice(result.data?.queued
        ? "Zlecono pobranie brakujących faktur. Agent podejmie pracę w najbliższym cyklu."
        : "Agent już pracuje nad synchronizacją. Odśwież dane po zakończeniu jego cyklu.");
    } catch (error) {
      setImportNotice(error?.message || "Nie udało się zlecić importu.");
    } finally {
      setImporting(false);
    }
  }
  useEffect(() => {
    getProfile().then(result => setOwnerId(result?.user?.id || "")).catch(()=>{});
  }, []);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const [documentsResponse, summaryResponse] = await Promise.all([
          getFinancialDocuments({ limit: PAGE_SIZE + 1, offset: page * PAGE_SIZE, source }),
          getFinanceSummary()
        ]);
        if (!active) return;
        const { documents, summary: financeSummary } = parseFinanceDashboardResponses(documentsResponse, summaryResponse);
        setItems(documents.slice(0, PAGE_SIZE));
        setHasMore(documents.length > PAGE_SIZE);
        setSummary(financeSummary);
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
  }, [source, page, refreshKey]);

  return (
    <main className="min-h-screen min-w-0 overflow-x-clip bg-[#070e22] px-3 py-5 text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto w-full min-w-0 max-w-[1680px]">
        <header className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/[.04] px-5 py-4">
          <Link href="/" className="inline-flex items-center gap-3 text-lg font-black">
            <ArrowLeft size={18} className="text-cyan-300" aria-hidden="true" /> Przem<span className="-ml-3 text-cyan-300">AI</span>
          </Link>
          <UserMenu />
        </header>
        <Navbar />
        <section className="mt-8">
          <div className="flex min-w-0 flex-wrap items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <span className="inline-flex items-center gap-2 rounded-full border border-cyan-400/25 bg-cyan-400/10 px-3 py-1 text-xs font-bold text-cyan-200">
                <Wallet size={14} aria-hidden="true" /> FINANCIAL AGENT
              </span>
              <h1 className="mt-4 text-3xl font-black tracking-tight sm:text-4xl">Centrum finansów</h1>
              <Link href="/finance/reports" className="mt-3 inline-flex min-h-10 items-center rounded-xl border border-cyan-300/30 bg-cyan-300/10 px-4 text-sm font-bold text-cyan-100 hover:bg-cyan-300/20">Raport miesięczny i kwartalny <ArrowUpRight size={15} className="ml-2"/></Link>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
                Dokumenty z KSeF i poczty, ich kwoty, opisy oraz przypisanie do inwestycji.
                Dane faktur nie są potwierdzeniem zapłaty.
              </p>
            </div>
            <div className="flex w-full flex-wrap items-center gap-2 lg:w-auto lg:justify-end">
            <button type="button" onClick={requestKsefImport} disabled={importing}
              className="inline-flex min-h-11 min-w-0 items-center justify-center gap-2 rounded-xl border border-emerald-300/30 bg-emerald-300/10 px-5 py-3 text-sm font-bold text-emerald-100 transition hover:bg-emerald-300/20 disabled:opacity-50">
              {importing ? "Zlecam..." : "Pobierz brakujące faktury"}
            </button>
            <button type="button" onClick={() => setRefreshKey(key => key + 1)}
              disabled={loading}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-cyan-300/30 bg-cyan-300/10 px-5 py-3 text-sm font-bold text-cyan-100 transition hover:bg-cyan-300/20 disabled:opacity-50">
              <RefreshCw size={17} className={loading ? "animate-spin" : ""} aria-hidden="true" />
              Odśwież dane
            </button>
            </div>
          </div>
          {importNotice && <p role="status" className="mt-4 text-sm text-emerald-200">{importNotice}</p>}
          {ownerId && <details className="mt-4 max-w-full text-xs text-slate-400">
            <summary className="cursor-pointer select-none">Identyfikator konta KSeF</summary>
            <button type="button" onClick={() => navigator.clipboard.writeText(ownerId)}
              className="mt-2 max-w-full break-all font-mono text-cyan-200 underline underline-offset-4"
              title="Skopiuj identyfikator konta">{ownerId}</button>
          </details>}
          <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <StatCard label="Wszystkie dokumenty" value={summary?.total} icon={FileText} description="Łącznie w systemie" />
            <StatCard label="Z poczty" value={summary?.mail} icon={Wallet} description="Załączniki e-mail" />
            <StatCard label="Z KSeF" value={summary?.ksef} icon={ShieldCheck} description="Dokumenty z integracji" />
          </div>
        </section>

        {Array.isArray(summary?.amounts) && summary.amounts.length > 0 &&
          <section className="mt-7 min-w-0 overflow-hidden rounded-3xl border border-white/10 bg-white/[.045] p-4 sm:p-6">
            <h2 className="text-xl font-bold">Zestawienie kwot z KSeF</h2>
            <p className="mt-2 text-sm text-slate-400">Kwoty z oficjalnych metadanych. VAT jest wykazany w PLN. Zestawienie nie oznacza potwierdzenia płatności.</p>
            <div className="mt-4 max-w-full overflow-x-auto">
              <table className="min-w-[680px] w-full text-sm text-left">
                <thead className="text-xs uppercase tracking-wide text-slate-400"><tr>
                  <th className="p-3">Rodzaj</th><th className="p-3">Waluta</th>
                  <th className="p-3">Faktury</th><th className="p-3">Netto</th>
                  <th className="p-3">VAT w PLN</th><th className="p-3">Brutto</th>
                </tr></thead>
                <tbody>{summary.amounts.map((amount, index) => (
                  <tr key={index} className="border-t border-white/10">
                    <td className="p-3">{amount.direction === "INCOMING" ? "Zakupowe" : amount.direction === "OUTGOING" ? "Sprzedażowe" : "Niesklasyfikowane"}</td>
                    <td className="p-3">{amount.currency}</td>
                    <td className="p-3 tabular-nums">{amount.count}</td>
                    <td className="p-3 tabular-nums">{formatMoney(amount.net, amount.currency)}</td>
                    <td className="p-3 tabular-nums">{formatMoney(amount.vatPLN, "PLN")}</td>
                    <td className="p-3 tabular-nums font-bold">{formatMoney(amount.gross, amount.currency)}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          </section>
        }

        <section className="mt-8 overflow-hidden rounded-3xl border border-white/10 bg-white/[.045]">
          <div className="flex min-w-0 flex-wrap items-center justify-between gap-3 border-b border-white/10 p-4 sm:p-6">
            <div className="min-w-0">
              <h2 className="flex items-center gap-2 text-xl font-bold"><Filter size={20} className="text-cyan-300" aria-hidden="true" /> Rejestr dokumentów</h2>
              <p className="mt-3 max-w-full break-words text-xs text-slate-400">
                <Link href="/finance/projects" className="font-semibold text-cyan-300 underline underline-offset-4">
                  Zarządzaj inwestycjami i aliasami do automatycznego przypisywania
                </Link>
              </p>
              <p className="mt-2 text-xs text-slate-400">
                {loading ? "Ładowanie…" : error ? "Dane niedostępne" : "Strona " + (page + 1) + " · dokumenty: " + items.length}
                {refreshedAt && !loading && !error ? " · Aktualizacja: " + refreshedAt.toLocaleTimeString("pl-PL") : ""}
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
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
            <div className="min-w-0">
              <div className="grid min-w-0 gap-3 p-3 sm:p-5 md:grid-cols-2 xl:hidden">
                {items.map(item => (
                  <article key={item.id} className="min-w-0 overflow-hidden rounded-2xl border border-white/10 bg-slate-900/40 p-4">
                    <div className="flex min-w-0 flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
                      <span className="whitespace-nowrap">{formatDate(item.issueDate || (item.source === "MAIL" ? item.rawData?.receivedAt : null))}</span>
                      <span className="rounded-lg border border-blue-400/20 bg-blue-400/10 px-2 py-1 font-semibold text-blue-200">
                        {SOURCE_LABELS[item.source] || item.source || "—"}
                      </span>
                    </div>
                    <div className="mt-3 min-w-0 break-words text-base font-semibold leading-snug text-white">
                      {item.source === "KSEF" ?
                        <Link href={"/finance/" + encodeURIComponent(item.id)} className="text-cyan-200 underline decoration-cyan-500/50 underline-offset-4">
                          {item.displayTitle || item.invoiceNumber || item.ksefNumber || "Otwórz fakturę"} <ArrowUpRight size={14} className="inline" />
                        </Link> : (item.invoiceNumber || item.rawData?.filename || "Dokument z poczty")}
                    </div>
                    <p className="mt-2 line-clamp-2 min-w-0 break-words text-xs text-slate-300">
                      {item.sellerName || item.rawData?.from || "Kontrahent nieustalony"}
                    </p>
                    <p className="mt-2 line-clamp-2 min-w-0 break-words text-xs text-slate-400">
                      {item.metadata?.analysis?.description || (item.source === "KSEF" ? "Opis zostanie uzupełniony z XML." : "—")}
                    </p>
                    <div className="mt-4 grid min-w-0 grid-cols-3 gap-2 border-t border-white/10 pt-3">
                      <div className="min-w-0"><div className="text-[11px] text-slate-400">Netto</div><p className="mt-1 break-words text-xs font-semibold tabular-nums">{formatMoney(item.netAmount, item.currency)}</p></div>
                      <div className="min-w-0"><div className="text-[11px] text-slate-400">VAT (PLN)</div><p className="mt-1 break-words text-xs font-semibold tabular-nums">{formatMoney(item.vatAmount, "PLN")}</p></div>
                      <div className="min-w-0"><div className="text-[11px] text-slate-400">Brutto</div><p className="mt-1 break-words text-xs font-bold tabular-nums text-white">{formatMoney(item.grossAmount, item.currency)}</p></div>
                    </div>
                    <div className="mt-3 flex min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-2 text-xs">
                      <span className="min-w-0 break-words text-cyan-200">{item.project?.name || "Bez przypisanego projektu"}</span>
                      <span className="text-slate-400">Termin: {formatDate(item.dueDate)}</span>
                    </div>
                    {item.metadata?.analysis?.projectEvidence === "FOOTER" && item.project &&
                      <p className="mt-2 text-[11px] text-slate-400">Projekt rozpoznany ze stopki faktury</p>}
                  </article>
                ))}
              </div>
              <p className="hidden px-4 py-2 text-xs text-slate-400 xl:block">Kliknij nazwę faktury, aby zobaczyć szczegóły. Opisy mieszczą się w jednym wierszu z nazwą dokumentu.</p>
              <div className="hidden max-w-full overflow-x-auto xl:block">
                <table className="w-full min-w-[1120px] table-fixed text-left text-xs 2xl:text-sm">
                  <colgroup>
                    <col className="w-[9%]" /><col className="w-[27%]" /><col className="w-[15%]" />
                    <col className="w-[13%]" /><col className="w-[10%]" /><col className="w-[8%]" />
                    <col className="w-[10%]" /><col className="w-[8%]" />
                  </colgroup>
                  <thead className="border-b border-white/10 bg-slate-950/30 text-[11px] uppercase tracking-wide text-slate-400">
                    <tr>
                      <th scope="col" className="px-3 py-3">Data</th>
                      <th scope="col" className="px-3 py-3">Faktura / opis</th>
                      <th scope="col" className="px-3 py-3">Kontrahent</th>
                      <th scope="col" className="px-3 py-3">Inwestycja</th>
                      <th scope="col" className="px-3 py-3">Netto</th>
                      <th scope="col" className="px-3 py-3">VAT (PLN)</th>
                      <th scope="col" className="px-3 py-3">Brutto</th>
                      <th scope="col" className="px-3 py-3">Termin</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map(item => (
                      <tr key={item.id} className="border-b border-white/[.07] align-top transition hover:bg-white/[.035]">
                        <td className="whitespace-nowrap px-3 py-3 text-slate-300">
                          {formatDate(item.issueDate || (item.source === "MAIL" ? item.rawData?.receivedAt : null))}
                          <span className="mt-1 block text-[11px] text-slate-500">{SOURCE_LABELS[item.source] || item.source || "—"}</span>
                        </td>
                        <td className="min-w-0 px-3 py-3">
                          <div className="line-clamp-2 break-words font-semibold text-white">
                            {item.source === "KSEF" ?
                              <Link href={"/finance/" + encodeURIComponent(item.id)} className="text-cyan-200 underline decoration-cyan-500/50 underline-offset-4 hover:text-cyan-100">
                                {item.displayTitle || item.invoiceNumber || item.ksefNumber || "Otwórz fakturę"} <ArrowUpRight size={12} className="inline" />
                              </Link> : (item.invoiceNumber || item.rawData?.filename || "Dokument z poczty")}
                          </div>
                          <div className="mt-1 line-clamp-2 break-words text-[11px] text-slate-400" title={item.metadata?.analysis?.description || ""}>
                            {item.metadata?.analysis?.description || (item.source === "KSEF" ? "Oczekuje na opis z XML" : "—")}
                          </div>
                        </td>
                        <td className="min-w-0 break-words px-3 py-3 text-slate-300">{item.sellerName || item.rawData?.from || "—"}</td>
                        <td className="min-w-0 break-words px-3 py-3 font-medium text-cyan-100">
                          {item.project?.name || "—"}
                          {item.project && item.metadata?.analysis?.projectEvidence === "FOOTER" &&
                            <span className="mt-1 block text-[11px] font-normal text-slate-400">Ze stopki</span>}
                        </td>
                        <td className="px-3 py-3 tabular-nums text-slate-300">{formatMoney(item.netAmount, item.currency)}</td>
                        <td className="px-3 py-3 tabular-nums text-slate-300">{formatMoney(item.vatAmount, "PLN")}</td>
                        <td className="px-3 py-3 font-semibold tabular-nums text-white">{formatMoney(item.grossAmount, item.currency)}</td>
                        <td className="whitespace-nowrap px-3 py-3 text-slate-300">{formatDate(item.dueDate)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {(page > 0 || hasMore) &&
                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 p-4">
                  <p className="text-xs text-slate-400">Strona {page + 1} · pozycje {page * PAGE_SIZE + 1}–{page * PAGE_SIZE + items.length}</p>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" disabled={loading || page === 0} onClick={() => setPage(p => Math.max(0, p - 1))}
                      className="min-h-11 rounded-xl border border-white/20 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">Poprzednia</button>
                    <button type="button" disabled={loading || !hasMore} onClick={() => setPage(p => p + 1)}
                      className="min-h-11 rounded-xl border border-cyan-300/30 bg-cyan-300/10 px-4 py-2 text-sm font-semibold text-cyan-100 disabled:opacity-40">Następna</button>
                  </div>
                </div>}
            </div>
          ) : null}
        </section>
        <footer className="py-8 text-center text-xs text-slate-500">PrzemAI · Dane dostępne wyłącznie po zalogowaniu · Bez automatycznych płatności</footer>
      </div>
    </main>
  );
}
