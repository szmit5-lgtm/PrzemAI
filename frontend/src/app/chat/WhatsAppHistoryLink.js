"use client";

import { useState } from "react";
import { changeWhatsAppHistoryLink } from "@/lib/api";

export default function WhatsAppHistoryLink({ organizationId, conversationId }) {
  const [contact, setContact] = useState("");
  const [code, setCode] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  async function change(unlink) {
    setBusy(true);
    setCode("");
    setStatus("");
    try {
      const response = await changeWhatsAppHistoryLink(organizationId, conversationId, contact, unlink);
      if (unlink) setStatus("Wyłączono przekazywanie nowych wiadomości z tego numeru.");
      else if (typeof response?.data?.message === "string") {
        setCode(response.data.message);
        setStatus("Wyślij kod ręcznie z podanego numeru na firmowy numer WhatsApp. Kod wygaśnie po 5 minutach.");
      } else throw Error("Nie udało się uzyskać kodu.");
    } catch (error) {
      setStatus(error.status === 404 ? "Łączenie historii WhatsApp jest niedostępne w tej spółce." : error.message);
    } finally { setBusy(false); }
  }
  const enabled = !busy && /^\d{6,20}$/.test(contact);
  return <details className="text-xs text-slate-300">
    <summary className="cursor-pointer text-violet-200">Połącz historię WhatsApp</summary>
    <form onSubmit={event => { event.preventDefault(); if (enabled) void change(false); }} className="mt-2 space-y-2">
      <label className="block">Numer nadawcy z prefiksem kraju, same cyfry
        <input value={contact} onChange={event => { setContact(event.target.value); setCode(""); setStatus(""); }}
          type="tel" inputMode="numeric" maxLength={20} disabled={busy}
          className="mt-1 block w-full max-w-xs rounded-md border border-white/20 bg-slate-950 px-2 py-1" />
      </label>
      <div className="flex flex-wrap gap-3">
        <button className="min-h-9 text-violet-200 disabled:opacity-50" disabled={!enabled} type="submit">Wygeneruj kod</button>
        <button className="min-h-9 text-slate-300 disabled:opacity-50" disabled={!enabled} type="button"
          onClick={() => change(true)}>Odłącz numer</button>
      </div>
      {status && <p role="status">{status}</p>}
      {code && <code className="block select-all break-all">{code}</code>}
    </form>
  </details>;
}
