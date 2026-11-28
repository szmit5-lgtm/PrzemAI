"use client";

import { useEffect, useState } from "react";
import { getSystemAiUsage } from "@/lib/api";

const currency = new Intl.NumberFormat("pl-PL", { style: "currency", currency: "PLN", maximumFractionDigits: 6 });
const formatMoney = microPln => currency.format(Number(microPln) / 1000000);

export default function AiUsage() {
  const [usage, setUsage] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    getSystemAiUsage().then(({ data }) => {
      if (!data) throw new Error("Brak danych o wykorzystaniu budżetu.");
      if (active) setUsage(data);
    }).catch(failure => {
      if (active) setError(failure.message);
    });
    return () => { active = false; };
  }, []);

  return (
    <section className="mt-5 rounded-3xl border border-white/10 bg-[#111c35] p-5" aria-labelledby="ai-usage-title">
      <h2 id="ai-usage-title" className="text-xl font-bold">Budżet OpenAI</h2>
      {error && <p role="alert" className="mt-3 text-rose-300">{error}</p>}
      {!error && !usage && <p role="status" className="mt-3 text-slate-300">Pobieram wykorzystanie budżetu…</p>}
      {usage && (
        <>
          <dl className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-sm text-slate-300">Rezerwacje miesięczne · {usage.month} UTC</dt>
              <dd className="mt-1 text-xl font-semibold">{formatMoney(usage.reservedMicroPln)} / {formatMoney(usage.budgetLimitMicroPln)}</dd>
            </div>
            <div>
              <dt className="text-sm text-slate-300">Żądania objęte limitem · {usage.day} UTC</dt>
              <dd className="mt-1 text-xl font-semibold">{usage.requests} / {usage.requestsLimit}</dd>
            </div>
          </dl>
          <p className="mt-4 text-sm text-slate-300">Rezerwacje pokazują szacowaną górną granicę kosztów żądań dopuszczonych przez limit. Rzeczywiste opłaty są dostępne w rozliczeniach OpenAI.</p>
        </>
      )}
    </section>
  );
}
