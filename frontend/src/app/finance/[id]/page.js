"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Download, FileText, Printer, RefreshCw } from "lucide-react";
import { getFinancialDocument, getFinanceProjects, assignFinanceProject } from "@/lib/api";

function money(value, currency = "PLN") {
  if (value === null || value === undefined || value === "") return "—";
  const number = Number(value);
  if (!Number.isFinite(number)) return "—";
  try {
    return new Intl.NumberFormat("pl-PL", { style: "currency", currency }).format(number);
  } catch {
    return String(value) + " " + currency;
  }
}

function date(value) {
  if (!value) return "—";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "—" : parsed.toLocaleDateString("pl-PL");
}

// Parse official FA invoice XML in the browser without executing markup.
// Read the direct children of each FaWiersz, never scrape unrelated nested tags.
function parseItems(xml) {
  if (!xml || typeof window === "undefined") return [];
  if (/<!\s*(?:DOCTYPE|ENTITY)\b/i.test(xml)) return [];
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  if (doc.getElementsByTagName("parsererror").length) return [];
  const rows = Array.from(doc.getElementsByTagName("*"))
    .filter(node => node.localName === "FaWiersz").slice(0, 250);
  const field = (node, tag) => Array.from(node.children)
    .find(child => child.localName === tag)?.textContent?.trim() || "";
  return rows.map((row, i) => ({
    id: field(row, "NrWierszaFa") || String(i + 1),
    name: field(row, "P_7") || field(row, "Indeks") || "Pozycja faktury",
    unit: field(row, "P_8A"),
    quantity: field(row, "P_8B"),
    unitNet: field(row, "P_9A"),
    net: field(row, "P_11"),
    gross: field(row, "P_11A"),
    vat: field(row, "P_11Vat"),
    vatRate: field(row, "P_12")
  }));
}

function readPaymentTerms(xml) {
  if (!xml || typeof window === "undefined" || /<!\s*(?:DOCTYPE|ENTITY)\b/i.test(xml)) {
    return { terms: [], paidAtIssue: false };
  }
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  if (doc.getElementsByTagName("parsererror").length) return { terms: [], paidAtIssue: false };
  const all = Array.from(doc.getElementsByTagName("*"));
  const payment = all.find(node => node.localName === "Platnosc");
  if (!payment) return { terms: [], paidAtIssue: false };
  const descendants = Array.from(payment.getElementsByTagName("*"));
  const terms = descendants.filter(node => node.localName === "TerminPlatnosci")
    .flatMap(node => Array.from(node.children)
      .filter(child => child.localName === "Termin" && /^\d{4}-\d{2}-\d{2}$/.test(child.textContent.trim()))
      .map(child => child.textContent.trim()));
  const paid = Array.from(payment.children)
    .find(node => node.localName === "Zaplacono")?.textContent?.trim() === "1";
  return { terms: [...new Set(terms)], paidAtIssue: paid };
}

function Info({ label, value }) {
  return <div className="rounded-xl border border-white/10 bg-white/[.035] p-4">
    <div className="text-xs font-medium text-slate-400">{label}</div>
    <div className="mt-2 break-words text-base font-semibold text-white">{value || "—"}</div>
  </div>;
}

export default function FinancialDocumentPage() {
  const params = useParams();
  const id = params?.id;
  const [record, setRecord] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [projects, setProjects] = useState([]);
  const [chosenProject, setChosenProject] = useState("");
  const [assigning, setAssigning] = useState(false);
  const [notice, setNotice] = useState("");
  useEffect(() => {
    getFinanceProjects().then(r=>setProjects(Array.isArray(r.items) ? r.items : [])).catch(()=>{});
  }, []);
  useEffect(() => {
    setChosenProject(record?.projectId || "");
  }, [record?.projectId]);

  useEffect(() => {
    if (typeof id !== "string") return;
    let active = true;
    setLoading(true);
    setError("");
    getFinancialDocument(id).then(response => {
      if (active) setRecord(response.item);
    }).catch(err => {
      if (active) { setError(err.message || "Nie udało się pobrać faktury."); setRecord(null); }
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id, refresh]);

  const items = useMemo(() => parseItems(record?.rawData?.xml), [record?.rawData?.xml]);
  const payment = useMemo(() => readPaymentTerms(record?.rawData?.xml), [record?.rawData?.xml]);

  async function saveProject() {
    if (!record?.id || assigning) return;
    setAssigning(true);
    setNotice("");
    try {
      await assignFinanceProject(record.id, chosenProject || null);
      setNotice("Przypisanie projektu zapisane.");
      setRefresh(n=>n+1);
    } catch(error) {
      setNotice(error.message || "Błąd przypisywania projektu.");
    } finally {
      setAssigning(false);
    }
  }

  function downloadXml() {
    const xml = record?.rawData?.xml;
    if (!xml) return;
    const blob = new Blob([xml], { type: "application/xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = (record.invoiceNumber || record.ksefNumber || "faktura").replace(/[^a-zA-Z0-9._-]+/g, "_") + ".xml";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  return <main className="min-h-screen bg-[#070e22] px-4 py-6 text-slate-100 sm:px-8 print:bg-white print:text-black">
    <div className="mx-auto max-w-6xl">
      <header className="flex flex-wrap items-center justify-between gap-4 print:hidden">
        <Link href="/finance" className="inline-flex items-center gap-2 text-sm font-bold text-cyan-200 hover:text-cyan-100">
          <ArrowLeft size={17} /> Powrót do Centrum finansów
        </Link>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setRefresh(x => x + 1)} className="inline-flex items-center gap-2 rounded-xl border border-white/20 px-4 py-2.5 text-sm"><RefreshCw size={16} /> Odśwież</button>
          <button disabled={!record?.rawData?.xml} onClick={downloadXml} className="inline-flex items-center gap-2 rounded-xl border border-white/20 px-4 py-2.5 text-sm disabled:opacity-40"><Download size={16} /> Pobierz XML</button>
          <button onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-xl border border-white/20 px-4 py-2.5 text-sm"><Printer size={16} /> Drukuj / PDF</button>
        </div>
      </header>
      {loading ? <p className="mt-12 text-slate-300">Pobieranie faktury…</p> :
        error ? <p role="alert" className="mt-12 text-rose-300">{error}</p> :
        record ? <>
          <div className="mt-8 flex items-center gap-3"><FileText className="text-cyan-300 print:text-black" size={27}/>
            <div><div className="text-sm uppercase tracking-widest text-cyan-300 print:text-black">Faktura KSeF</div>
              <h1 className="mt-1 break-all text-2xl font-black sm:text-3xl">{record.displayTitle || record.invoiceNumber || record.ksefNumber || "Dokument"}</h1>
            </div>
          </div>
          <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Info label="Netto" value={money(record.netAmount, record.currency)}/>
            <Info label="VAT (w PLN)" value={money(record.vatAmount, "PLN")}/>
            <Info label="Brutto" value={money(record.grossAmount, record.currency)}/>
            <Info label="Data wystawienia" value={date(record.issueDate)}/>
          </div>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <Info label="Sprzedawca" value={[record.sellerName, record.sellerNip && "NIP: " + record.sellerNip].filter(Boolean).join(" · ")}/>
            <Info label="Nabywca" value={[record.buyerName, record.buyerNip && "NIP: " + record.buyerNip].filter(Boolean).join(" · ")}/>
            <Info label="Numer KSeF" value={record.ksefNumber}/>
            <Info label="Termin płatności" value={payment.terms.length ? payment.terms.map(date).join(", ") : date(record.dueDate)}/>
          </div>
          {payment.paidAtIssue && <p className="mt-4 text-xs text-slate-300">Na dokumencie wystawca oznaczył płatność jako dokonaną przed wystawieniem. Nie jest to potwierdzenie bieżącego stanu konta bankowego.</p>}
          <section className="mt-8 rounded-2xl border border-white/10 bg-white/[.04] p-5 print:hidden">
            <h2 className="text-xl font-bold">Opis i przypisanie inwestycji</h2>
            <p className="mt-3 text-sm text-slate-200">
              {record.metadata?.analysis?.description || "Agent przygotuje opis na podstawie pozycji faktury podczas najbliższej synchronizacji."}
            </p>
            <p className="mt-2 text-xs text-slate-400">
              {record.metadata?.analysis?.projectDecision === "AUTO_ASSIGNED"
                ? "Projekt rozpoznany automatycznie na podstawie opisu pozycji."
                : record.metadata?.analysis?.projectDecision === "MANUAL"
                ? "Projekt wskazany ręcznie."
                : "Projekt wymaga sprawdzenia — brak jednoznacznego dopasowania."}
            </p>
            <div className="mt-4 flex flex-wrap items-end gap-3">
              <label className="text-sm">Projekt
                <select value={chosenProject} onChange={e=>setChosenProject(e.target.value)}
                  className="mt-1 block min-w-56 rounded-xl border border-white/20 bg-[#101d3c] px-4 py-3">
                  <option value="">Nieprzypisany</option>
                  {projects.map(project=><option key={project.id} value={project.id}>{project.name}</option>)}
                </select>
              </label>
              <button disabled={assigning} onClick={saveProject}
                className="rounded-xl bg-cyan-400 px-5 py-3 text-sm font-bold text-slate-950 disabled:opacity-40">
                {assigning ? "Zapisuję..." : "Zapisz przypisanie"}
              </button>
              <Link href="/finance/projects" className="text-sm text-cyan-300 underline underline-offset-4">
                Dodaj inwestycję
              </Link>
            </div>
            {notice && <p role="status" className="mt-3 text-xs text-cyan-200">{notice}</p>}
          </section>
          <section className="mt-8 rounded-2xl border border-white/10 bg-white/[.04] p-5">
            <h2 className="text-xl font-bold">Za co wystawiono fakturę</h2>
            {items.length ? <div className="mt-5 overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="text-xs uppercase text-slate-400 print:text-black">
                  <tr><th className="p-3">Lp.</th><th className="p-3">Towar / usługa</th>
                    <th className="p-3">Ilość</th><th className="p-3">J.m.</th>
                    <th className="p-3">Cena netto</th><th className="p-3">Wartość netto</th><th className="p-3">VAT pozycji</th><th className="p-3">Wartość brutto</th><th className="p-3">Stawka VAT</th></tr>
                </thead>
                <tbody>{items.map((item, index) => <tr key={index} className="border-t border-white/10">
                  <td className="p-3">{item.id}</td><td className="min-w-48 p-3 font-semibold">{item.name}</td>
                  <td className="p-3">{item.quantity || "—"}</td><td className="p-3">{item.unit || "—"}</td>
                  <td className="p-3">{money(item.unitNet, record.currency)}</td>
                  <td className="p-3">{money(item.net, record.currency)}</td>
                  <td className="p-3">{item.vat || "—"}</td>
                  <td className="p-3">{money(item.gross, record.currency)}</td>
                  <td className="p-3">{item.vatRate || "—"}</td>
                </tr>)}</tbody>
              </table>
            </div> : <p className="mt-4 text-sm text-slate-300 print:text-black">
              {record.rawData?.xml
                ? "Dokument XML pobrano, ale nie udało się odczytać pozycji w oczekiwanym formacie."
                : "Metadane faktury są już dostępne. Pobieranie pełnego XML odbywa się przez Financial Agent. Odśwież po kolejnym uruchomieniu agenta."}
            </p>}
          </section>
          <p className="mt-4 text-xs text-slate-400 print:text-black">
            Dane z KSeF nie są potwierdzeniem zapłaty. VAT z metadanych KSeF jest kwotą w PLN.
          </p>
        </> : <p className="mt-12 text-slate-300">Nie znaleziono dokumentu.</p>}
    </div>
  </main>;
}
