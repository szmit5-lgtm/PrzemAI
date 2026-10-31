"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Activity, ArrowLeft, Bot, Clock3, Mail, Play, Plug, RefreshCw, ShieldCheck, ToggleLeft, ToggleRight } from "lucide-react";
import Navbar from "../components/Navbar";
import UserMenu from "../components/UserMenu";
import { getAgents, runAgent, setAgentEnabled, getIntegrations, setIntegrationEnabled } from "@/lib/api";
import { parseAgentDashboardResponses, getAgentDashboardSummary } from "@/lib/agentDashboardPayload";

function formatDate(value) {
  if (!value) return "Brak danych";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Brak danych" : date.toLocaleString("pl-PL");
}

function statusLabel(status) {
  const labels = {
    IDLE: "Oczekuje",
    RUNNING: "W trakcie pracy",
    ERROR: "Wymaga uwagi",
    DISABLED: "Wyłączony",
    SUCCESS: "Sukces",
    FAILED: "Błąd"
  };
  return labels[status] || status || "Nieznany";
}

function statusClass(status) {
  if (status === "RUNNING") return "border-cyan-400/30 bg-cyan-400/10 text-cyan-200";
  if (status === "ERROR" || status === "FAILED") return "border-rose-400/30 bg-rose-400/10 text-rose-200";
  if (status === "DISABLED") return "border-slate-400/20 bg-slate-400/10 text-slate-300";
  return "border-emerald-400/25 bg-emerald-400/10 text-emerald-200";
}

export default function AgentsPage() {
  const [agents, setAgents] = useState([]);
  const [integrations, setIntegrations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const [agentsResponse, integrationsResponse] = await Promise.all([getAgents(), getIntegrations()]);
        if (!active) return;
        const { agents: agentList, integrations: integrationList } = parseAgentDashboardResponses(agentsResponse, integrationsResponse);
        setAgents(agentList);
        setIntegrations(integrationList);
      } catch (err) {
        if (active) {
          setError(err?.message || "Nie udało się pobrać danych agentów.");
          setAgents([]);
          setIntegrations([]);
        }
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => { active = false; };
  }, [refreshKey]);

  async function act(key, callback, successMessage) {
    if (pending || loading) return;
    setPending(key);
    setError("");
    setNotice("");
    try {
      await callback();
      setNotice(successMessage);
      setRefreshKey(value => value + 1);
    } catch (err) {
      setError(err?.message || "Operacja nie powiodła się.");
    } finally {
      setPending("");
    }
  }

  const busy = Boolean(pending) || loading;
  const summary = getAgentDashboardSummary(agents, integrations, { loading, error });

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
              <span className="inline-flex items-center gap-2 rounded-full border border-cyan-400/25 bg-cyan-400/10 px-3 py-1 text-xs font-bold text-cyan-200"><Bot size={14} aria-hidden="true" /> AGENT RUNTIME</span>
              <h1 className="mt-4 text-3xl font-black sm:text-4xl">Agenci i integracje</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">Rzeczywiste agenty przypisane do Twojego konta, ich uruchomienia oraz dostępne integracje. Włączenie agenta nie gwarantuje poprawnej konfiguracji zewnętrznej usługi.</p>
            </div>
            <button type="button" disabled={busy} onClick={() => setRefreshKey(value => value + 1)}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-cyan-300/30 bg-cyan-300/10 px-5 py-3 text-sm font-bold text-cyan-100 hover:bg-cyan-300/20 disabled:opacity-50">
              <RefreshCw size={17} className={loading ? "animate-spin" : ""} aria-hidden="true" /> Odśwież
            </button>
          </div>

          {error && <div role="alert" className="mt-5 rounded-xl border border-rose-400/30 bg-rose-400/10 p-4 text-sm text-rose-200">{error}</div>}
          {notice && !error && <div role="status" className="mt-5 rounded-xl border border-emerald-400/25 bg-emerald-400/10 p-4 text-sm text-emerald-200">{notice}</div>}
          <div className="mt-7 grid grid-cols-2 gap-3 md:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-white/[.05] p-5"><Activity className="text-cyan-300" size={20} aria-hidden="true" /><p className="mt-3 text-3xl font-bold">{summary.agentCount ?? "—"}</p><p className="mt-1 text-sm text-slate-400">Agenci na koncie</p></div>
            <div className="rounded-2xl border border-white/10 bg-white/[.05] p-5"><Bot className="text-cyan-300" size={20} aria-hidden="true" /><p className="mt-3 text-3xl font-bold">{summary.enabledAgentCount ?? "—"}</p><p className="mt-1 text-sm text-slate-400">Włączeni</p></div>
            <div className="col-span-2 rounded-2xl border border-white/10 bg-white/[.05] p-5 md:col-span-1"><Plug className="text-cyan-300" size={20} aria-hidden="true" /><p className="mt-3 text-3xl font-bold">{summary.enabledIntegrationCount ?? "—"}</p><p className="mt-1 text-sm text-slate-400">Włączone integracje</p></div>
          </div>
        </section>

        <section className="mt-8">
          <h2 className="text-2xl font-bold">Agenci</h2>
          <p className="mt-2 text-sm text-slate-400">„Włączony” oznacza gotowość do uruchomienia według harmonogramu, a nie ciągłą aktywność.</p>
          {loading ? <p role="status" className="mt-6 text-slate-300">Ładowanie agentów…</p> :
            error ? null : summary.showEmptyAgents ? <div className="mt-5 rounded-2xl border border-white/10 bg-white/[.05] p-8 text-sm text-slate-300">Brak skonfigurowanych agentów na tym koncie.</div> :
            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              {agents.map(agent => (
                <article key={agent.id} className="rounded-3xl border border-white/10 bg-gradient-to-br from-[#14274c] to-[#0b152c] p-6">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div><div className="flex items-center gap-3"><div className="rounded-xl border border-cyan-400/20 bg-cyan-400/10 p-3"><Bot size={23} className="text-cyan-300" /></div><h3 className="text-xl font-bold">{agent.name}</h3></div><p className="mt-3 text-xs text-slate-400">Typ: {agent.type || "—"}</p></div>
                    <span className={"rounded-full border px-3 py-1 text-xs font-semibold " + statusClass(agent.status)}>{statusLabel(agent.status)}</span>
                  </div>
                  <div className="mt-5 grid grid-cols-2 gap-3 rounded-xl border border-white/10 bg-black/10 p-4 text-xs text-slate-300">
                    <div><Clock3 size={16} className="mb-2 text-cyan-300" /> Interwał: {agent.intervalMinutes ?? "—"} min</div>
                    <div>Ostatni przebieg:<br /><span className="text-white">{formatDate(agent.lastRunAt)}</span></div>
                    <div className="col-span-2">Następny termin: <span className="text-white">{agent.enabled ? formatDate(agent.nextRunAt) : "Wyłączony"}</span></div>
                  </div>
                  {agent.runs?.length > 0 && <div className="mt-4 text-xs text-slate-400">Ostatni wynik: <span className="text-slate-200">{statusLabel(agent.runs[0].status)}</span> · {formatDate(agent.runs[0].startedAt)}</div>}
                  <div className="mt-5 flex flex-wrap gap-3">
                    <button type="button" disabled={busy || !agent.enabled || agent.status === "RUNNING"}
                      onClick={() => act("run:" + agent.id, () => runAgent(agent.id), "Przyjęto polecenie uruchomienia agenta. Sprawdź status poniżej.")}
                      className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-cyan-400 px-4 py-2.5 text-sm font-bold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-50">
                      <Play size={16} /> {pending === "run:" + agent.id ? "Uruchamianie…" : "Uruchom teraz"}
                    </button>
                    <button type="button" disabled={busy || agent.status === "RUNNING"}
                      onClick={() => act("toggle:" + agent.id, () => setAgentEnabled(agent.id, !agent.enabled), agent.enabled ? "Agent wyłączony." : "Agent włączony.")}
                      className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/20 px-4 py-2.5 text-sm font-semibold text-white hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50">
                      {agent.enabled ? <ToggleRight size={18} className="text-emerald-300" /> : <ToggleLeft size={18} />} {agent.enabled ? "Wyłącz" : "Włącz"}
                    </button>
                  </div>
                </article>
              ))}
            </div>}
        </section>

        <section className="mt-10">
          <h2 className="flex items-center gap-2 text-2xl font-bold"><Plug className="text-cyan-300" /> Integracje</h2>
          <p className="mt-2 text-sm text-slate-400">Włączenie integracji może rozpocząć pobieranie danych z podłączonej usługi.</p>
          {summary.showEmptyIntegrations && <div className="mt-5 rounded-2xl border border-white/10 bg-white/[.05] p-8 text-sm text-slate-300">Brak integracji na tym koncie.</div>}
          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            {!loading && !error && integrations.map(integration => (
              <article key={integration.id} className="rounded-3xl border border-white/10 bg-white/[.05] p-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-center gap-3"><Mail size={22} className="text-cyan-300" aria-hidden="true" /><div><h3 className="text-lg font-bold">{integration.name}</h3><p className="mt-1 text-xs text-slate-400">{integration.provider} · {integration.type}</p></div></div>
                  <span className={"rounded-full border px-3 py-1 text-xs " + (integration.enabled ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-200" : "border-slate-400/20 bg-slate-400/10 text-slate-300")}>{integration.enabled ? "Włączona" : "Wyłączona"}</span>
                </div>
                <p className="mt-5 text-sm text-slate-300">Ostatnia synchronizacja: <span className="text-white">{formatDate(integration.lastSyncAt)}</span></p>
                <button type="button" disabled={busy}
                  onClick={() => act("integration:" + integration.id, () => setIntegrationEnabled(integration.id, !integration.enabled), integration.enabled ? "Integracja wyłączona." : "Integracja włączona.")}
                  className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/20 px-4 py-2.5 text-sm font-semibold hover:bg-white/10 disabled:opacity-50">
                  {integration.enabled ? <ToggleRight size={18} className="text-emerald-300" /> : <ToggleLeft size={18} />} {integration.enabled ? "Wyłącz integrację" : "Włącz integrację"}
                </button>
              </article>
            ))}
          </div>
        </section>
        <footer className="flex items-center justify-center gap-2 py-10 text-center text-xs text-slate-500"><ShieldCheck size={14} /> PrzemAI · Widoczne są wyłącznie zasoby przypisane do zalogowanego użytkownika</footer>
      </div>
    </main>
  );
}
