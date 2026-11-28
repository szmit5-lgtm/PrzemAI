"use client";

import { useState } from "react";
import { getPersonalExport } from "@/lib/api";

export default function PersonalExport() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function download() {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const data = await getPersonalExport();
      const file = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(file);
      const link = document.createElement("a");
      link.href = url;
      link.download = "przemai-eksport-osobisty.json";
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setNotice(data.truncatedSections.length
        ? "Pobrano plik. Co najmniej jedna sekcja przekroczyła limit 500 pozycji."
        : "Pobrano plik.");
    } catch (failure) {
      setError(failure.message || "Nie udało się pobrać pliku.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-6 rounded-2xl border border-white/10 bg-[#111c35] p-5" aria-labelledby="personal-export-title">
      <h2 id="personal-export-title" className="text-lg font-semibold">Eksport danych osobistych</h2>
      <p className="mt-2 text-sm text-slate-300">Plik JSON zawiera podstawowe dane konta, zadania osobiste i listę analiz dokumentów oraz spotkań. Każda lista obejmuje do 500 ostatnio zmienionych pozycji.</p>
      <button type="button" onClick={download} disabled={busy}
        className="mt-4 min-h-11 rounded-lg bg-violet-700 px-4 font-semibold disabled:opacity-50">
        {busy ? "Przygotowywanie…" : "Pobierz JSON"}
      </button>
      {error && <p role="alert" className="mt-2 text-rose-300">{error}</p>}
      {notice && <p role="status" className="mt-2 text-slate-300">{notice}</p>}
    </section>
  );
}
