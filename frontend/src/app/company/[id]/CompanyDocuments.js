"use client";
import { useEffect, useState } from "react";
import { FileDown, FileText, RefreshCw, UploadCloud, ShieldCheck, Camera } from "lucide-react";
import {
  getOrganizationDocuments, uploadOrganizationDocument, downloadOrganizationDocument
} from "@/lib/api";

const MAX_FILE_SIZE = 8 * 1024 * 1024;
const validExtension = /\.(pdf|docx|txt)$/i;
const formatSize = size => (size / (1024 * 1024)).toLocaleString("pl-PL", { maximumFractionDigits: 2 }) + " MB";
export default function CompanyDocuments({ organizationId, organizationName }) {
  const [items, setItems] = useState([]);
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [converting, setConverting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [downloading, setDownloading] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function refresh() {
    setLoading(true); setError("");
    try {
      const result = await getOrganizationDocuments(organizationId);
      if (!Array.isArray(result?.items)) throw new Error("Nieprawidłowa lista dokumentów.");
      setItems(result.items);
    } catch (err) { setError(err?.message || "Nie udało się pobrać dokumentów."); }
    finally { setLoading(false); }
  }
  useEffect(() => {
    let active = true;
    setLoading(true); setError(""); setNotice(""); setItems([]); setFile(null);
    getOrganizationDocuments(organizationId).then(result => {
      if (active) setItems(Array.isArray(result?.items) ? result.items : []);
    }).catch(error => { if (active) setError(error?.message || "Nie udało się otworzyć biblioteki."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [organizationId]);

  async function selectPhoto(event) {
    const photo = event.target.files?.[0];
    event.target.value = "";
    if (!photo) return;
    setConverting(true);
    setFile(null);
    setError("");
    setNotice("");
    try {
      const { capturePhotoDocument } = await import("@/lib/photoDocument.mjs");
      setFile(await capturePhotoDocument(photo));
    } catch {
      setError("Nie udało się przygotować zdjęcia. Wybierz mniejszy plik JPEG lub PNG.");
    } finally {
      setConverting(false);
    }
  }

  async function submit(event) {
    event.preventDefault();
    if (!file || saving || converting) return;
    const formElement = event.currentTarget;
    if (!validExtension.test(file.name) || file.size < 1 || file.size > MAX_FILE_SIZE) {
      setError("Wybierz dokument PDF, DOCX lub TXT o rozmiarze do 8 MB.");
      return;
    }
    setSaving(true); setError(""); setNotice("");
    try {
      const result = await uploadOrganizationDocument(organizationId, file);
      if (!result?.item?.id) throw new Error("Brak potwierdzenia zapisu dokumentu.");
      setItems(old => [result.item, ...old.filter(item => item.id !== result.item.id)]);
      setFile(null);
      formElement.reset();
      setNotice("Dokument zapisany w przestrzeni: " + (organizationName || "wybrana spółka") + ".");
    } catch (err) { setError(err?.message || "Nie udało się dodać dokumentu."); }
    finally { setSaving(false); }
  }
  async function download(item) {
    if (downloading) return;
    setDownloading(item.id); setError("");
    try {
      const blob = await downloadOrganizationDocument(organizationId, item.id);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = item.name;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) { setError(err?.message || "Nie można pobrać pliku."); }
    finally { setDownloading(""); }
  }
  return <section aria-label="Dokumenty firmowe" className="mt-5 min-w-0 rounded-2xl border border-white/10 bg-[#111c35] p-4 sm:p-6">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 className="flex items-center gap-2 text-lg font-bold"><FileText size={19} className="text-violet-300"/> Dokumenty — {organizationName || "spółka"}</h2>
        <p className="mt-1 text-xs leading-5 text-slate-400">Dokumenty przypisane tylko do tej spółki. Dostęp mają właściciel i administratorzy; pliki nie trafiają do Historii konta osobistego ani do innych spółek.</p>
      </div>
      <button type="button" onClick={refresh} disabled={loading || saving}
        className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/20 px-3 text-sm hover:bg-white/5 disabled:opacity-50">
        <RefreshCw size={16} className={loading ? "animate-spin" : ""}/> Odśwież
      </button>
    </div>
    <form onSubmit={submit} className="mt-5 rounded-xl border border-violet-400/25 bg-violet-500/[.065] p-4">
      <p className="mb-3 rounded-xl border border-emerald-400/25 bg-emerald-400/10 px-3 py-2 text-sm text-emerald-100"><strong>Przypisanie pliku:</strong> {organizationName || "wybrana spółka"}</p>
      <label htmlFor="company-document-file" className="block text-sm font-semibold">Dodaj dokument do: {organizationName || "wybrana spółka"}
        <input id="company-document-file" type="file" accept=".pdf,.docx,.txt"
          onChange={event => { setFile(event.target.files?.[0] || null); event.target.value = ""; setError(""); setNotice(""); }}
          disabled={saving || converting} className="mt-3 block w-full min-w-0 text-sm text-slate-300 file:mr-3 file:rounded-lg file:border-0 file:bg-violet-400 file:px-3 file:py-2 file:font-semibold file:text-slate-950"/>
      </label>
      <label className="mt-3 inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-white/20 px-3 text-sm focus-within:ring-2 focus-within:ring-violet-300">
        <Camera size={18} aria-hidden="true"/> Zrób zdjęcie dokumentu
        <input type="file" accept="image/*" capture="environment" onChange={selectPhoto}
          disabled={saving || converting} className="sr-only"/>
      </label>
      {converting && <p role="status" className="mt-2 text-sm">Przygotowywanie PDF…</p>}
      {file && <p className="mt-2 break-all text-sm">Wybrano: {file.name} · {formatSize(file.size)}</p>}
      <p className="mt-2 text-xs text-slate-400">PDF, DOCX lub TXT · maksymalnie 8 MB na plik. Dokument zostanie zapisany bez automatycznej analizy AI.</p>
      <button type="submit" disabled={saving || converting || !file}
        className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl bg-violet-500 px-4 text-sm font-bold text-white hover:bg-violet-400 disabled:opacity-50">
        <UploadCloud size={18}/>{saving ? "Zapisywanie…" : "Dodaj dokument"}
      </button>
    </form>
    {error && <p role="alert" className="mt-4 rounded-xl border border-rose-400/30 bg-rose-500/10 p-3 text-sm text-rose-200">{error}</p>}
    {notice && <p role="status" className="mt-4 rounded-xl border border-emerald-400/30 bg-emerald-500/10 p-3 text-sm text-emerald-200">{notice}</p>}
    <div className="mt-6 flex items-center justify-between gap-2"><h3 className="text-base font-bold">Zapisane dokumenty</h3><span className="text-xs text-slate-400">{loading ? "…" : items.length + " plików"}</span></div>
    {loading ? <p className="mt-4 text-sm text-slate-400">Ładowanie dokumentów…</p> : !items.length ? <div className="mt-3 rounded-xl border border-dashed border-white/15 p-6 text-center text-sm text-slate-400">Nie dodano jeszcze dokumentów do tej firmy.</div> :
      <ul className="mt-3 space-y-2">{items.map(item => <li key={item.id} className="flex min-w-0 flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-white/[.035] p-3">
        <span className="rounded-lg bg-violet-500/15 p-2 text-violet-200"><FileText size={18}/></span>
        <div className="min-w-0 flex-1">
          <p className="break-all text-sm font-semibold">{item.name}</p>
          <p className="mt-1 text-xs text-slate-400">{formatSize(item.size)} · {new Date(item.createdAt).toLocaleString("pl-PL")} · Spółka: {organizationName || "wybrana spółka"}</p>
        </div>
        <button type="button" onClick={() => download(item)} disabled={Boolean(downloading)}
          aria-label={"Pobierz " + item.name}
          className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/20 px-3 text-xs font-semibold hover:bg-white/10 disabled:opacity-50">
          <FileDown size={16}/>{downloading === item.id ? "Pobieranie…" : "Pobierz"}
        </button>
      </li>)}</ul>}
    <p className="mt-5 flex items-center gap-2 text-xs text-slate-400"><ShieldCheck size={15}/> Pliki są sprawdzane po stronie serwera i dostępne wyłącznie uprawnionym osobom.</p>
  </section>;
}
