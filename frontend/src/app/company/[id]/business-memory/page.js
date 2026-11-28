"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { getBusinessMemories, getOrganizationInvestments, removeBusinessMemory, saveBusinessMemory } from "@/lib/api";

const empty = { kind: "DECISION", text: "", counterparty: "", investmentId: "" };
const labels = { DECISION: "Decyzja", AGREEMENT: "Ustalenie" };
const field = "min-h-11 rounded-lg border border-white/20 bg-slate-950 px-3 py-2";
const button = "min-h-11 rounded-lg border border-violet-400/40 px-4 disabled:opacity-50";

function BusinessMemory({ organizationId }) {
  const company = "/company/" + encodeURIComponent(organizationId);
  const [list, setList] = useState(null);
  const [investments, setInvestments] = useState(null);
  const [entry, setEntry] = useState(empty);
  const [editing, setEditing] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [actionError, setActionError] = useState("");
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState("");
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoadError("");
    getBusinessMemories(organizationId, controller.signal).then(({ data }) => {
      if (!Array.isArray(data?.items)) throw new Error("Nieprawidłowa odpowiedź pamięci spółki.");
      if (!controller.signal.aborted) setList(data);
    }).catch(error => {
      if (!controller.signal.aborted) { setList(null); setLoadError(error.message); }
    });
    return () => controller.abort();
  }, [organizationId, refresh]);

  useEffect(() => {
    let active = true;
    getOrganizationInvestments(organizationId).then(({ data }) => {
      if (active && Array.isArray(data?.items)) setInvestments(data.items);
    }).catch(() => {});
    return () => { active = false; };
  }, [organizationId]);

  function reset() {
    setEditing(null);
    setEntry(empty);
  }

  async function mutate(action) {
    setBusy(true);
    setActionError("");
    try {
      await action();
      reset();
      setRefresh(value => value + 1);
    } catch (error) {
      setActionError(error.message);
    } finally {
      setBusy(false);
    }
  }

  const change = (name, value) => setEntry(current => ({ ...current, [name]: value }));
  const query = filter.trim().toLocaleLowerCase("pl");
  const matches = list?.items.filter(row => ((row.counterparty || "") + " " + row.text).toLocaleLowerCase("pl").includes(query));

  return <main className="min-h-screen bg-[#080e20] text-slate-100">
    <div className="mx-auto max-w-4xl px-4 pb-24 pt-5">
      <Link href={company} className="text-violet-300 underline">Wróć do spółki</Link>
      <h1 className="my-4 text-3xl font-bold">Pamięć biznesowa spółki</h1>
      {loadError && <p role="alert" className="text-rose-300">{loadError}</p>}
      {!list && !loadError && <p role="status">Pobieram wpisy…</p>}
      {list && <>
        <form id="memory-form" onSubmit={event => { event.preventDefault(); void mutate(() => saveBusinessMemory(organizationId, editing, entry)); }}
          className="grid gap-3 rounded-2xl border border-white/10 bg-[#111c35] p-4">
          <h2 className="text-lg font-semibold">{editing ? "Edytuj wpis" : "Nowy wpis"}</h2>
          <label className="grid gap-1">Rodzaj<select className={field} value={entry.kind} disabled={busy}
            onChange={event => change("kind", event.target.value)}>
            {Object.entries(labels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select></label>
          <label className="grid gap-1">Kontrahent<input className={field} value={entry.counterparty} maxLength={180} disabled={busy}
            onChange={event => change("counterparty", event.target.value)}/></label>
          <label className="grid gap-1">Inwestycja<select className={field} value={entry.investmentId} disabled={busy || !investments}
            onChange={event => change("investmentId", event.target.value)}>
            <option value="">{investments ? "Ogólne dla spółki" : "Lista inwestycji niedostępna"}</option>
            {investments?.map(row => <option key={row.id} value={row.id}>{row.name}</option>)}
            {entry.investmentId && !investments?.some(row => row.id === entry.investmentId) &&
              <option value={entry.investmentId}>Obecne powiązanie</option>}
          </select></label>
          <label className="grid gap-1">Treść<textarea className={field} required minLength={3} maxLength={5000}
            value={entry.text} disabled={busy} rows={4} onChange={event => change("text", event.target.value)}/></label>
          <div className="flex flex-wrap gap-2">
            <button className={button} disabled={busy || entry.text.trim().length < 3}>Zapisz</button>
            {editing && <button className={button} type="button" disabled={busy} onClick={reset}>Anuluj edycję</button>}
          </div>
          {actionError && <p role="alert" className="text-rose-300">{actionError}</p>}
        </form>
        <label className="mt-5 grid gap-1">Szukaj w widocznych wpisach
          <input type="search" className={field} value={filter} onChange={event => setFilter(event.target.value)}/>
        </label>
        {list.hasMore && <p className="mt-2 text-sm text-slate-300">Widoczne jest 100 ostatnio zmienionych wpisów.</p>}
        {matches.length === 0 && <p className="mt-3 text-slate-300">Brak pasujących wpisów.</p>}
        <ul className="mt-3 grid gap-3">
          {matches.map(row => <li key={row.id} className="rounded-xl border border-white/10 p-4">
            <h2 className="break-words font-semibold">{labels[row.kind]}{row.counterparty && " · " + row.counterparty}</h2>
            <p className="mt-2 whitespace-pre-wrap break-words">{row.text}</p>
            {row.investmentId && <Link className="mt-2 inline-block break-words text-violet-300 underline"
              href={company + "/investments/" + encodeURIComponent(row.investmentId)}>{row.investment?.name || "Inwestycja"}</Link>}
            <p className="mt-2 text-xs text-slate-300">Zapisano {new Date(row.createdAt).toLocaleString("pl-PL", { timeZone: "Europe/Warsaw" })}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <a className={button + " inline-flex items-center"} href="#memory-form" onClick={event => {
                if (busy) { event.preventDefault(); return; }
                setEntry({ kind: row.kind, counterparty: row.counterparty || "", text: row.text, investmentId: row.investmentId || "" });
                setEditing(row.id);
              }}>Edytuj</a>
              <button type="button" className={button} disabled={busy} onClick={() => {
                if (window.confirm("Usunąć ten wpis pamięci biznesowej?")) void mutate(() => removeBusinessMemory(organizationId, row.id));
              }}>Usuń</button>
            </div>
          </li>)}
        </ul>
      </>}
    </div>
  </main>;
}

export default function Page() {
  const { id } = useParams();
  return <BusinessMemory key={id} organizationId={id}/>;
}
