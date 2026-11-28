"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import Navbar from "../components/Navbar";
import { getOwnerBriefing, updateOwnerAlert, updateOwnerBriefingSchedule } from "@/lib/api";

const alertLabels = {
  taskOverdue: "Przeterminowane zadanie",
  urgentTask: "Pilne zadanie przed terminem",
  overduePayable: "Zaległe zobowiązania",
  overdueReceivable: "Zaległe należności",
  negativeForecast: "Ujemna prognoza salda operacyjnego"
};
const alertActions = {
  ACKNOWLEDGED: "Potwierdź", SNOOZED: "Odłóż na 24 godziny", CLOSED: "Zamknij", OPEN: "Otwórz ponownie"
};
const alertStates = { ACKNOWLEDGED: "Potwierdzony", SNOOZED: "Odłożony", CLOSED: "Zamknięty" };
const statuses = { IN_PROGRESS: "W toku", ON_HOLD: "Wstrzymane", NOT_SET: "Bez statusu" };
const section = "rounded-2xl border border-white/10 bg-[#111c35] p-4 sm:p-6";
const source = "break-words text-violet-300 underline underline-offset-4";

function amount(value, currency) {
  if (value == null) return "Brak potwierdzonej kwoty";
  if (typeof currency !== "string" || !/^[A-Z]{3}$/.test(currency)) return value + " · waluta nieustalona";
  return new Intl.NumberFormat("pl-PL", { style: "currency", currency }).format(value);
}

function CompanyBriefing({ company }) {
  const { finance } = company;
  return (
    <article className={section}>
      <h3 className="break-words text-xl font-semibold">{company.name}</h3>
      <Link className={source} href={company.href}>Otwórz spółkę</Link>
      <div className="mt-4 grid gap-5 lg:grid-cols-2">
        <div>
          <h4 className="font-semibold">Rozliczenia i płynność</h4>
          {finance.status !== "available" && <p className="mt-2 text-sm text-slate-300">
            {finance.status === "error" ? "Odczyt finansów nie powiódł się." : "Brak dostępnych rozliczeń dla tej spółki."}
          </p>}
          {finance.status === "available" && finance.balances.length === 0 &&
            <p className="mt-2 text-sm text-slate-300">Brak dokumentów w rozliczeniach.</p>}
          {finance.balances.map(row => (
            <dl key={row.currency} className="mt-2 grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 text-sm">
              <dt>Otwarte należności</dt><dd>{amount(row.receivable, row.currency)}</dd>
              <dt>Otwarte zobowiązania</dt><dd>{amount(row.payable, row.currency)}</dd>
            </dl>
          ))}
          {finance.forecast.map(row => (
            <dl key={row.currency} className="mt-3 grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 text-sm">
              <dt>Saldo VAT z importów</dt><dd>{amount(row.vatBalanceFromImports, row.currency)}</dd>
              <dt>Prognoza operacyjna na koniec miesiąca</dt><dd>{amount(row.projectedMonthEnd, row.currency)}</dd>
            </dl>
          ))}
          {finance.status === "available" && (
            <Link className={source + " mt-3 inline-block"} href={company.href + "/finance/bank-matches"}>Źródło rozliczeń i prognozy</Link>
          )}
        </div>
        <div>
          <h4 className="font-semibold">Inwestycje i terminy</h4>
          <ul className="mt-2 flex flex-wrap gap-3 text-sm">
            {Object.entries(statuses).map(([key, label]) => <li key={key}>{label} {company.investments[key] ?? 0}</li>)}
          </ul>
          <Link className={source + " mt-2 inline-block"} href={company.href + "/investments"}>Rejestr inwestycji</Link>
          {company.dueTasks.length ? (
            <ul className="mt-3 grid gap-2 text-sm">
              {company.dueTasks.map(task => <li key={task.id}><Link className={source} href={task.href}>{task.title}</Link>{" "}<time dateTime={task.dueOn}>{task.dueOn}</time></li>)}
            </ul>
          ) : <p className="mt-3 text-sm text-slate-300">Brak otwartych zadań z terminem w horyzoncie raportu.</p>}
          {company.moreTasks && <p className="mt-2 text-sm text-slate-300">Widoczne są najbliższe i najstarsze terminy. Pełna lista jest w panelu spółki.</p>}
        </div>
      </div>
    </article>
  );
}

export default function OwnerBriefingPage() {
  const [snapshot, setSnapshot] = useState(null);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [showHandled, setShowHandled] = useState(false);
  const [updating, setUpdating] = useState(null);
  const [alertError, setAlertError] = useState("");

  const [time, setTime] = useState("");
  const [savingTime, setSavingTime] = useState(false);
  const [scheduleError, setScheduleError] = useState("");

  async function saveTime(event) {
    event.preventDefault();
    setSavingTime(true);
    setScheduleError("");
    try {
      const { data } = await updateOwnerBriefingSchedule(time);
      setSnapshot(current => current && ({ ...current, scheduledTime: data.time }));
    } catch (error) {
      setScheduleError(error.message);
    } finally {
      setSavingTime(false);
    }
  }

  async function changeAlert(alert, status) {
    setUpdating(alert.id);
    setAlertError("");
    try {
      const { data } = await updateOwnerAlert(alert.id, status);
      setSnapshot(current => current && ({
        ...current, alerts: current.alerts.map(row => row.id === data.alertId
          ? { ...row, status: data.status, snoozedUntil: data.snoozedUntil } : row)
      }));
    } catch (failure) {
      setAlertError(failure.message);
    } finally {
      setUpdating(null);
    }
  }

  useEffect(() => {
    const controller = new AbortController();
    setError("");
    setSnapshot(null);
    getOwnerBriefing(controller.signal).then(({ data }) => {
      if (!data || !Array.isArray(data.companies) || !Array.isArray(data.alerts))
        throw new Error("Nieprawidłowa odpowiedź raportu.");
      if (!controller.signal.aborted) {
        setSnapshot(data);
        setTime(data.scheduledTime || "07:00");
      }
    }).catch(failure => {
      if (!controller.signal.aborted) setError(failure.message);
    });
    return () => controller.abort();
  }, [refresh]);

  const visibleAlerts = snapshot?.alerts.filter(alert => showHandled || alert.status === "OPEN") || [];

  return (
    <main className="min-h-screen bg-[#080e20] text-slate-100">
      <div className="mx-auto max-w-6xl px-4 pb-24 pt-5">
        <Navbar />
        <header className="my-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold">Poranny raport właściciela</h1>
            {snapshot && <p className="mt-2 text-slate-300">Stan na <time dateTime={snapshot.day}>{snapshot.day}</time> · terminy do 7 dni naprzód</p>}
          </div>
          <button type="button" onClick={() => setRefresh(value => value + 1)} disabled={Boolean(updating) || (!snapshot && !error)}
            className="min-h-11 rounded-lg border border-violet-400/40 px-4 disabled:opacity-50">Odśwież</button>
        </header>
        {error && <p role="alert" className="text-rose-300">{error}</p>}
        {!snapshot && !error && <p role="status">Pobieram raport…</p>}
        {snapshot && !snapshot.companies.length && <p>Raport jest dostępny dla właścicieli aktywnych spółek.</p>}
        {snapshot && snapshot.companies.length > 0 && (
          <>
            <section className={section + " mb-5"} aria-labelledby="schedule-title">
              <h2 id="schedule-title" className="text-xl font-semibold">Porównanie dzienne</h2>
              <form onSubmit={saveTime} className="mt-3 flex flex-wrap items-end gap-2">
                <label className="grid gap-1 text-sm">Godzina raportu w Polsce
                  <input type="time" className="min-h-11 rounded-lg border border-white/20 bg-slate-950 px-3"
                    value={time} required onChange={event => setTime(event.target.value)}/>
                </label>
                <button disabled={savingTime || time === snapshot.scheduledTime}
                  className="min-h-11 rounded-lg border border-violet-400/40 px-4 disabled:opacity-50">Zapisz godzinę</button>
              </form>
              {scheduleError && <p role="alert" className="mt-2 text-rose-300">{scheduleError}</p>}
              <p className="mt-3 text-sm text-slate-300">{snapshot.generatedAt
                ? "Dzisiejszy zapis o " + new Date(snapshot.generatedAt).toLocaleTimeString("pl-PL", { timeZone: "Europe/Warsaw" })
                : "Brak dzisiejszego zapisu harmonogramu."}</p>
              {Boolean(snapshot.comparison?.length) && <ul className="mt-2 space-y-1 text-sm">
                {snapshot.comparison.map(row => <li key={row.name}>{row.name} · otwarte alerty o zaległych zadaniach
                  {" "}{row.previous} wczoraj, {row.current} dzisiaj</li>)}
              </ul>}
              {!snapshot.comparison?.length && <p className="mt-2 text-sm text-slate-300">Brak danych porównawczych z poprzedniego dnia.</p>}
            </section>
            <section aria-labelledby="owner-alerts" className={section + " mb-5"}>
              <h2 id="owner-alerts" className="text-xl font-semibold">Alerty wymagające uwagi</h2>
              <label className="mt-2 flex items-center gap-2 text-sm">
                <input type="checkbox" checked={showHandled} onChange={event => setShowHandled(event.target.checked)} />
                Pokaż odłożone, potwierdzone i zamknięte
              </label>
              {alertError && <p role="alert" className="mt-2 text-rose-300">{alertError}</p>}
              {visibleAlerts.length ? (
                <ul className="mt-3 grid gap-2">
                  {visibleAlerts.map(alert => (
                    <li key={alert.id} className="break-words border-b border-white/10 pb-2">
                      <Link className={source} href={alert.href}>{alert.company} · {alertLabels[alert.kind]}</Link>{" "}
                      {alert.title ? <>{alert.title} · <time dateTime={alert.dueOn}>{alert.dueOn}</time></> : amount(alert.amount, alert.currency)}
                      {alert.status !== "OPEN" && <p className="mt-1 text-xs text-slate-300">
                        {alertStates[alert.status]}
                        {alert.snoozedUntil && <> do <time dateTime={alert.snoozedUntil}>{new Date(alert.snoozedUntil).toLocaleString("pl-PL", { timeZone: "Europe/Warsaw" })}</time></>}
                      </p>}
                      <div className="mt-2 flex flex-wrap gap-2">
                        {(alert.status === "OPEN" ? ["ACKNOWLEDGED", "SNOOZED", "CLOSED"] : ["OPEN"]).map(status =>
                          <button key={status} type="button" disabled={Boolean(updating)} onClick={() => changeAlert(alert, status)}
                            className="min-h-10 rounded-lg border border-white/20 px-3 text-sm disabled:opacity-50">{alertActions[status]}</button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : <p className="mt-2 text-sm text-slate-300">Brak alertów w dostępnych danych.</p>}
            </section>
            <section aria-labelledby="owner-companies" className="grid gap-4">
              <h2 id="owner-companies" className="text-xl font-semibold">Spółki</h2>
              {snapshot.moreCompanies && <p>Widok obejmuje pierwsze 20 spółek.</p>}
              {snapshot.companies.map(company => <CompanyBriefing key={company.id} company={company} />)}
            </section>
          </>
        )}
      </div>
    </main>
  );
}
