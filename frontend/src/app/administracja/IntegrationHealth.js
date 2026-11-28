"use client";

import { useEffect, useState } from "react";
import { getSystemIntegrationHealth } from "@/lib/api";

const configurations = {
  configured: "Konfiguracja obecna",
  unconfirmed: "Konfiguracja niepotwierdzona",
  disabled: "Wyłączona",
  manual: "Tryb ręczny",
  queue: "Kolejka aplikacji"
};

const evidence = {
  ksefSynced: "Udana synchronizacja w zapisanym przebiegu",
  importedStatement: "Import wyciągu",
  mailSynced: "Udana synchronizacja poczty",
  telegramReceipt: "Rejestracja wiadomości do przetworzenia",
  whatsAppReceived: "Zapis wiadomości przychodzącej",
  jobCompleted: "Zakończone zlecenie"
};

const date = value => new Date(value).toLocaleString("pl-PL");

export default function IntegrationHealth() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    getSystemIntegrationHealth(controller.signal).then(result => {
      if (!controller.signal.aborted) setData(result.data);
    }).catch(failure => {
      if (!controller.signal.aborted) setError(failure.message);
    });
    return () => controller.abort();
  }, []);

  return (
    <section className="mt-5 rounded-3xl border border-white/10 bg-[#111c35] p-5" aria-labelledby="integration-health-title">
      <h2 id="integration-health-title" className="text-xl font-bold">Stan integracji</h2>
      <p className="mt-2 text-sm text-slate-300">Odczyt konfiguracji API, zdarzeń na koncie i dostępnych spółek. Zapisane zdarzenie potwierdza aktywność w podanym czasie.</p>
      {error && <p role="alert" className="mt-3 text-rose-300">{error}</p>}
      {!error && !data && <p role="status" className="mt-3">Pobieram stan integracji…</p>}
      {data && (
        <>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {data.integrations.map(item => (
              <li key={item.name} className="rounded-xl border border-white/10 p-3">
                <h3 className="font-semibold">{item.name}</h3>
                <p className="mt-1 text-sm text-slate-300">{configurations[item.configuration]}</p>
                <p className="mt-1 text-sm text-slate-300">
                  {item.latestAt ? <>{evidence[item.evidence]} · <time dateTime={item.latestAt}>{date(item.latestAt)}</time></> : "Brak potwierdzonego zdarzenia"}
                </p>
              </li>
            ))}
          </ul>
          <h3 className="mt-5 font-semibold">Kolejki na tym koncie</h3>
          <ul className="mt-2 space-y-1 text-sm text-slate-300">
            <li>Agenci w toku {data.queues.agentsRunning} · w stanie błędu {data.queues.agentsInError}</li>
            <li>Kaldeva oczekuje {data.queues.kaldevaQueued} · w toku {data.queues.kaldevaRunning} · nieudane {data.queues.kaldevaFailed}</li>
            {data.queues.kaldevaLastFailureAt && <li>Ostatnie nieudane zlecenie Kaldeva · {date(data.queues.kaldevaLastFailureAt)}</li>}
          </ul>
        </>
      )}
    </section>
  );
}
