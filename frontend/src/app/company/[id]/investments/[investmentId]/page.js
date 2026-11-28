"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  attachInvestmentRecord, changeInvestmentTaskStatus, createInvestmentTask, downloadInvestmentReport, downloadOrganizationDocument, getInvestmentFinance,
  getInvestmentBudget, getInvestmentPanel, getOrganizationDocuments, getOrganizationWorkspace, saveInvestmentBudget, uploadOrganizationDocument
} from "@/lib/api";

const button = "inline-flex min-h-11 items-center rounded-lg border border-violet-400/40 px-3 text-sm font-semibold text-violet-100 hover:bg-violet-400/10 disabled:opacity-50";
const input = "min-h-11 min-w-0 rounded-lg border border-white/20 bg-[#0b1427] px-3";
const statusLabels = {
  NOT_SET: "Nie określono", IN_PROGRESS: "W toku", ON_HOLD: "Wstrzymana",
  COMPLETED: "Zakończona", TODO: "Do wykonania", DONE: "Zakończone"
};
const date = new Intl.DateTimeFormat("pl-PL", { dateStyle: "medium", timeZone: "UTC" });
const direction = value => value === "INCOMING" ? "Zakup" : "Sprzedaż";
const amount = (value, currency) => value == null ? "Brak kwoty" : String(value).replace(".", ",") + " " + currency;

function Section({ id, title, children }) {
  return <section id={id} className="min-w-0 rounded-xl border border-white/10 bg-[#111c35] p-4 sm:p-5">
    <h2 className="mb-3 text-lg font-semibold">{title}</h2>
    {children}
  </section>;
}

function InvestmentBudget({ organizationId, investmentId, year, actual }) {
  const empty = { currency: "PLN", plannedNet: "", forecastNet: "" };
  const [budget, setBudget] = useState(null);
  const [form, setForm] = useState(empty);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    getInvestmentBudget(organizationId, investmentId, year, controller.signal).then(({ data }) => {
      if (!controller.signal.aborted) {
        const current = data.items.find(row => row.currency === "PLN");
        setBudget(data);
        if (current) setForm({ currency: "PLN", plannedNet: current.plannedNet ?? "", forecastNet: current.forecastNet ?? "" });
      }
    }).catch(failure => {
      if (!controller.signal.aborted) setError(failure.message);
    });
    return () => controller.abort();
  }, [organizationId, investmentId, year]);

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const { data } = await saveInvestmentBudget(organizationId, investmentId, year, form.currency, form);
      setBudget(current => ({ ...current, items: [...current.items.filter(row => row.currency !== data.currency), data]
        .sort((left, right) => left.currency.localeCompare(right.currency)) }));
    } catch (failure) { setError(failure.message); }
    finally { setSaving(false); }
  }
  const currencies = [...new Set([...(budget?.items.map(row => row.currency) || []), ...actual.map(row => row.currency)])].sort();
  const change = (name, value) => setForm(current => ({ ...current, [name]: value }));
  const chooseCurrency = value => {
    const currency = value.toUpperCase();
    const row = budget.items.find(item => item.currency === currency);
    setForm({ currency, plannedNet: row?.plannedNet ?? "", forecastNet: row?.forecastNet ?? "" });
  };

  return <div className="my-4 rounded-lg border border-white/10 p-3">
    <h3 className="font-semibold">Budżet kosztów netto</h3>
    <p className="mt-1 text-xs text-slate-300">Plan i prognoza to wartości wpisane przez właściciela. Wykonanie pochodzi z przypisanych faktur KSeF.</p>
    {error && <p role="alert" className="mt-2 text-sm text-rose-200">{error}</p>}
    {!error && !budget && <p role="status" className="mt-2 text-sm">Pobieranie budżetu…</p>}
    {budget && currencies.length === 0 && <p className="mt-2 text-sm text-slate-300">Brak danych budżetu dla wybranego roku.</p>}
    {budget && currencies.length > 0 && <ul className="mt-3 grid gap-2 sm:grid-cols-2">
      {currencies.map(currency => {
        const row = budget.items.find(item => item.currency === currency);
        return <li key={currency} className="rounded-lg bg-white/5 p-3">
          <strong>{currency}</strong>
          <dl className="mt-2 grid grid-cols-[1fr_auto] gap-x-2 gap-y-1 text-sm">
            <dt>Plan</dt><dd>{amount(row?.plannedNet, currency)}</dd>
            <dt>Wykonanie</dt><dd>{amount(actual.find(item => item.currency === currency)?.netCosts, currency)}</dd>
            <dt>Prognoza</dt><dd>{amount(row?.forecastNet, currency)}</dd>
          </dl>
          {budget.canEdit && row && <button type="button" className="mt-2 text-sm text-violet-200 underline" disabled={saving}
            onClick={() => setForm({ currency, plannedNet: row.plannedNet ?? "", forecastNet: row.forecastNet ?? "" })}>Edytuj {currency}</button>}
        </li>;
      })}
    </ul>}
    {budget?.canEdit && <form onSubmit={submit} className="mt-3 grid items-end gap-2 sm:grid-cols-4">
      <label className="grid gap-1 text-sm">Waluta<input className={input} value={form.currency}
        onChange={event => chooseCurrency(event.target.value)} minLength={3} maxLength={3} pattern="[A-Z]{3}" required/></label>
      <label className="grid gap-1 text-sm">Plan netto<input className={input} value={form.plannedNet}
        inputMode="decimal" maxLength={19} onChange={event => change("plannedNet", event.target.value)}/></label>
      <label className="grid gap-1 text-sm">Prognoza netto<input className={input} value={form.forecastNet}
        inputMode="decimal" maxLength={19} onChange={event => change("forecastNet", event.target.value)}/></label>
      <button className={button} disabled={saving}>Zapisz budżet</button>
    </form>}
  </div>;
}

function Finance({ organizationId, investmentId }) {
  const [year, setYear] = useState(new Date().getFullYear());
  const [offset, setOffset] = useState(0);
  const [result, setResult] = useState(null);
  const [retry, setRetry] = useState(0);
  const [exportError, setExportError] = useState("");
  const [exporting, setExporting] = useState(false);

  async function exportFile(format) {
    setExportError("");
    setExporting(true);
    try { await downloadInvestmentReport(organizationId, investmentId, year, format); }
    catch (error) { setExportError(error.message); }
    finally { setExporting(false); }
  }

  useEffect(() => {
    const controller = new AbortController();
    getInvestmentFinance(organizationId, investmentId, year, offset, controller.signal)
      .then(({ data }) => { if (!controller.signal.aborted) setResult({ year, offset, retry, data }); })
      .catch(error => { if (!controller.signal.aborted) setResult({ year, offset, retry, error }); });
    return () => controller.abort();
  }, [organizationId, investmentId, year, offset, retry]);

  const current = result?.year === year && result.offset === offset && result.retry === retry ? result : null;
  const finance = current?.data;

  return <Section id="finanse" title="Podsumowanie finansowe i faktury">
    <label className="flex flex-wrap items-center gap-2 text-sm">Rok wystawienia
      <select value={year} onChange={event => { setYear(Number(event.target.value)); setOffset(0); }} className={input}>
        {Array.from({ length: new Date().getFullYear() - 2019 }, (_, index) => new Date().getFullYear() - index)
          .map(value => <option key={value}>{value}</option>)}
      </select>
    </label>
    <div role="group" aria-label="Raport inwestycji" className="mt-3 flex flex-wrap gap-2">
      <button className={button} type="button" disabled={exporting} onClick={() => exportFile("pdf")}>Pobierz PDF</button>
      <button className={button} type="button" disabled={exporting} onClick={() => exportFile("xlsx")}>Pobierz Excel</button>
    </div>
    {exportError && <p role="alert" className="mt-2 text-rose-200">{exportError}</p>}
    <InvestmentBudget key={year} organizationId={organizationId} investmentId={investmentId} year={year}
      actual={finance?.profitability || []}/>
    {!current && <p role="status" className="mt-3 text-sm text-slate-300">Pobieranie faktur KSeF…</p>}
    {current?.error && <div className="mt-3 space-y-2">
      <p role="alert">{current.error.message}</p>
      {![403, 404].includes(current.error.status) && <button className={button} onClick={() => setRetry(value => value + 1)}>Ponów</button>}
    </div>}
    {finance && <>
      {finance.mapping !== "EXACT_NAME"
        ? <p className="mt-3 text-slate-300">Brak jednoznacznego powiązania z projektem KSeF.</p>
        : finance.totals.length === 0
          ? <p className="mt-3 text-slate-300">Brak przypisanych faktur KSeF w wybranym roku.</p>
          : <>
            <p className="mt-3 text-sm text-slate-300">Kwoty z przypisanych faktur KSeF, według waluty i kierunku.</p>
            <ul className="my-3 grid gap-2 sm:grid-cols-2">
              {finance.totals.map(row => <li key={row.currency + row.direction} className="rounded-lg bg-white/5 p-3">
                <p className="text-sm text-slate-300">{direction(row.direction)} · {row.count} faktur</p>
                <strong>{amount(row.net, row.currency)} netto</strong>
                <p className="mt-1 text-xs text-slate-300">{amount(row.gross, row.currency)} brutto · VAT {amount(row.vat, row.currency)}</p>
              </li>)}
            </ul>
            {!!finance.profitability?.length && (
              <div className="my-4 space-y-2">
                <h3 className="text-base font-semibold">Wynik na przypisanych fakturach</h3>
                <p className="text-xs text-slate-300">Obliczenie według kwot netto z faktur. Wynik księgowy może uwzględniać inne koszty i przychody.</p>
                <ul className="grid gap-2 sm:grid-cols-2">
                  {finance.profitability.map(row => <li key={row.currency} className="rounded-lg bg-white/5 p-3">
                    <dl className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 text-sm">
                      <dt>Przychody netto</dt><dd>{amount(row.netSales, row.currency)}</dd>
                      <dt>Koszty netto</dt><dd>{amount(row.netCosts, row.currency)}</dd>
                      <dt>Wynik netto</dt><dd className="font-semibold">{amount(row.netResult, row.currency)}</dd>
                      <dt>Marża</dt><dd>{row.marginPercent == null ? "—" : Number(row.marginPercent).toLocaleString("pl-PL") + "%"}</dd>
                    </dl>
                  </li>)}
                </ul>
              </div>
            )}
            <h3 className="text-base font-semibold">Faktury</h3>
            <ul className="divide-y divide-white/10">
              {finance.invoices.map(invoice => <li key={invoice.id} className="flex flex-wrap justify-between gap-x-4 gap-y-1 py-3 text-sm">
                <div className="min-w-0 break-words"><strong>{invoice.invoiceNumber || "Faktura bez numeru"}</strong>
                  <p className="text-slate-300">{direction(invoice.direction)} · {date.format(new Date(invoice.issueDate))}</p>
                </div>
                <div className="text-right">
                  <strong className="block">{amount(invoice.netAmount, invoice.currency)} netto</strong>
                  <span className="text-xs text-slate-300">{amount(invoice.grossAmount, invoice.currency)} brutto</span>
                </div>
              </li>)}
            </ul>
            <div className="flex flex-wrap gap-2">
              {offset > 0 && <button className={button} onClick={() => setOffset(value => value - 50)}>Poprzednie faktury</button>}
              {finance.nextOffset != null && <button className={button} onClick={() => setOffset(finance.nextOffset)}>Następne faktury</button>}
            </div>
          </>}
    </>}
  </Section>;
}

function InvestmentTimeline({ panel }) {
  const events = [
    { key: "investment", label: "Dodano inwestycję", at: panel.investment.createdAt },
    ...panel.tasks.flatMap(task => [
      { key: task.id + ":task", label: "Dodano zadanie · " + task.title, at: task.createdAt },
      { key: task.id + ":complete", label: "Zakończono zadanie · " + task.title, at: task.completedAt }
    ]),
    ...panel.documents.map(file => ({ key: file.id + ":doc", label: (file.contentType?.startsWith("image/") ? "Dodano zdjęcie · " : "Zapisano dokument · ") + file.name, at: file.createdAt })),
    ...panel.reports.map(file => ({ key: file.id + ":report", label: "Dodano sprawozdanie · " + file.name, at: file.createdAt }))
  ].filter(event => event.at).sort((left, right) => right.at.localeCompare(left.at) || left.key.localeCompare(right.key));
  return <Section id="historia" title="Oś czasu">
    {events.length ? <ol className="divide-y divide-white/10">
      {events.slice(0, 25).map(event => <li key={event.key} className="grid gap-1 py-2 text-sm sm:grid-cols-[9rem_1fr]">
        <time dateTime={event.at} className="text-slate-300">{date.format(new Date(event.at))}</time>
        <span className="break-words">{event.label}</span>
      </li>)}
    </ol> : <p className="text-sm text-slate-300">Brak zapisanych dat zdarzeń.</p>}
    {(events.length > 25 || panel.moreTasks) && <p className="mt-2 text-xs text-slate-300">Oś pokazuje najnowsze zdarzenia z widocznych rekordów.</p>}
  </Section>;
}

function Files({ files, onDownload, empty }) {
  if (!files.length) return <p className="text-sm text-slate-300">{empty}</p>;
  return <ul className="divide-y divide-white/10">
    {files.map(file => <li key={file.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
      <span className="min-w-0 break-all text-sm">{file.name}</span>
      <button className={button} onClick={() => onDownload(file)} aria-label={"Pobierz " + file.name}>Pobierz</button>
    </li>)}
  </ul>;
}

function AttachRecords({ organizationId, investmentId, investmentName, onAttached }) {
  const [kind, setKind] = useState("task");
  const [records, setRecords] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function loadRecords() {
    setError("");
    setBusy(true);
    try {
      const [workspace, documents] = await Promise.all([
        getOrganizationWorkspace(organizationId), getOrganizationDocuments(organizationId)
      ]);
      setRecords({ tasks: workspace.data.tasks, files: documents.items.filter(file => !file.investmentId) });
    } catch (failure) { setError(failure.message); }
    finally { setBusy(false); }
  }

  async function attach(event) {
    event.preventDefault();
    const recordId = new FormData(event.currentTarget).get("record");
    setBusy(true);
    setError("");
    try {
      await attachInvestmentRecord(organizationId, investmentId, recordId, kind);
      setRecords(current => kind === "task"
        ? { ...current, tasks: current.tasks.filter(row => row.id !== recordId) }
        : { ...current, files: current.files.filter(row => row.id !== recordId) });
      onAttached();
    } catch (failure) { setError(failure.message); }
    finally { setBusy(false); }
  }

  const choices = kind === "task" ? records?.tasks : records?.files;
  const normalize = value => value.toLocaleLowerCase("pl").normalize("NFD")
    .replace(/\p{M}/gu, "").replace(/ł/g, "l").replace(/[^a-z0-9]+/g, " ").trim();
  const project = normalize(investmentName);
  const suggested = file => kind !== "task" && project.length >= 4 && (" " + normalize(file.name) + " ").includes(" " + project + " ");
  const sorted = [...(choices || [])].sort((left, right) => Number(suggested(right)) - Number(suggested(left)));
  return <div className="mt-4 border-t border-white/10 pt-4">
    {!records ? <button className={button} disabled={busy} onClick={loadRecords}>Pokaż istniejące rekordy do przypisania</button> :
      <form onSubmit={attach} className="flex min-w-0 flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-sm">Rodzaj rekordu
          <select className={input} value={kind} onChange={event => setKind(event.target.value)}>
            <option value="task">Zadanie</option><option value="document">Dokument</option><option value="report">Sprawozdanie</option>
          </select>
        </label>
        <label className="flex min-w-0 max-w-full flex-col gap-1 text-sm">Rekord spółki
          <select required key={kind} name="record" className={input + " max-w-full"}>
            <option value="">{choices.length ? "Wybierz rekord" : "Brak wolnych rekordów"}</option>
            {sorted.map(row => <option key={row.id} value={row.id}>{suggested(row) ? "Sugestia · " : ""}{row.title || row.name}</option>)}
          </select>
        </label>
        <button className={button} disabled={busy || !choices.length}>Przypisz</button>
      </form>}
    {error && <p role="alert" className="mt-2 text-rose-200">{error}</p>}
  </div>;
}

function InvestmentPanel({ organizationId, investmentId }) {
  const [panel, setPanel] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [actionError, setActionError] = useState("");
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  const [uploadKind, setUploadKind] = useState("document");
  useEffect(() => {
    const controller = new AbortController();
    getInvestmentPanel(organizationId, investmentId, controller.signal)
      .then(({ data }) => { if (!controller.signal.aborted) setPanel(data); })
      .catch(error => {
        if (!controller.signal.aborted) {
          setPanel(null);
          setLoadError(error.message);
        }
      });
    return () => controller.abort();
  }, [organizationId, investmentId, revision]);

  async function run(action) {
    setActionError("");
    setBusy(true);
    try { await action(); }
    catch (error) { setActionError(error.message); }
    finally { setBusy(false); }
  }

  function upload(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    run(async () => {
      await uploadOrganizationDocument(organizationId, data.get("file"), investmentId, data.get("kind") === "report");
      form.reset();
      setRevision(value => value + 1);
    });
  }

  function addTask(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const title = new FormData(form).get("title");
    run(async () => {
      await createInvestmentTask(organizationId, investmentId, title);
      form.reset();
      setRevision(value => value + 1);
    });
  }

  function download(file) {
    run(async () => {
      const blob = await downloadOrganizationDocument(organizationId, file.id, investmentId);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = file.name;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    });
  }

  return <main className="min-h-screen bg-[#080e20] px-3 py-5 pb-24 text-slate-100 sm:px-6">
    <div className="mx-auto max-w-5xl space-y-4">
      <nav aria-label="Powrót" className="flex flex-wrap gap-2">
        <Link className={button} href="/">Pulpit</Link>
        <Link className={button} href={"/company/" + encodeURIComponent(organizationId) + "/investments"}>Inwestycje spółki</Link>
      </nav>
      {loadError && <p role="alert" className="text-rose-200">{loadError}</p>}
      {!panel && !loadError && <p role="status">Pobieranie inwestycji…</p>}
      {panel && <>
        <header className="rounded-xl border border-white/10 bg-[#111c35] p-4 sm:p-6">
          <h1 className="break-words text-2xl font-bold sm:text-4xl">{panel.investment.name}</h1>
          <p className="mt-2 text-slate-300">{statusLabels[panel.investment.status] || statusLabels.NOT_SET}</p>
          {panel.investment.description && <p className="mt-3 whitespace-pre-wrap break-words">{panel.investment.description}</p>}
          <div className="mt-4">
            <p className="mb-1 text-sm">Postęp prac · {panel.investment.progress == null ? "Brak pomiaru" : panel.investment.progress + "%"}</p>
            {panel.investment.progress != null && <progress aria-label="Postęp prac" max="100" value={panel.investment.progress} className="w-full accent-cyan-400"/>}
          </div>
          <nav aria-label="Sekcje inwestycji" className="mt-3 flex flex-wrap gap-2">
            {[["historia", "Oś czasu"], ["zadania", "Zadania"], ["dokumenty", "Dokumenty"], ["zdjecia", "Zdjęcia"], ["sprawozdania", "Sprawozdania"], ["finanse", "Finanse"]]
              .map(([id, label]) => <a key={id} className={button} href={"#" + id}>{label}</a>)}
          </nav>
        </header>
        {actionError && <p role="alert" className="text-rose-200">{actionError}</p>}
        <div className="grid gap-3 md:grid-cols-2">
          <Section id="zadania" title="Zadania">
            {!panel.tasks.length && <p className="text-sm text-slate-300">Brak przypisanych zadań.</p>}
            <ul className="divide-y divide-white/10">
              {panel.tasks.map(task => <li key={task.id} className="break-words py-2 text-sm">
                <strong>{task.title}</strong>
                {task.dueDate && <p className="text-slate-300">Termin {date.format(new Date(task.dueDate))}</p>}
                <select className={input + " mt-1 max-w-full"} value={task.status} disabled={busy}
                  aria-label={"Status zadania " + task.title} onChange={event => {
                    const status = event.target.value;
                    run(async () => {
                      await changeInvestmentTaskStatus(organizationId, investmentId, task.id, status);
                      setRevision(value => value + 1);
                    });
                  }}>
                  {["TODO", "IN_PROGRESS", "DONE"].map(status => <option key={status} value={status}>{statusLabels[status]}</option>)}
                </select>
              </li>)}
            </ul>
            {panel.moreTasks && <p className="text-sm text-slate-300">Wyświetlono 100 najnowszych zadań.</p>}
            <form className="mt-3 flex flex-wrap items-end gap-2" onSubmit={addTask}>
              <label className="flex min-w-0 flex-1 flex-col gap-1 text-sm">Tytuł zadania
                <input className={input} required name="title" minLength={3} maxLength={180}/>
              </label>
              <button className={button} disabled={busy}>Dodaj zadanie</button>
            </form>
          </Section>
          <div className="space-y-3">
            <Section id="dokumenty" title="Dokumenty">
              <Files files={panel.documents.filter(file => !file.contentType?.startsWith("image/"))} onDownload={download} empty="Brak przypisanych dokumentów."/>
            </Section>
            <Section id="zdjecia" title="Zdjęcia">
              <Files files={panel.documents.filter(file => file.contentType?.startsWith("image/"))}
                onDownload={download} empty="Brak przypisanych zdjęć."/>
            </Section>
            <Section id="sprawozdania" title="Sprawozdania">
              <Files files={panel.reports} onDownload={download} empty="Brak przypisanych sprawozdań."/>
            </Section>
          </div>
        </div>
        {panel.canManage && <Section title="Dodaj lub przypisz rekord">
          <form className="flex flex-wrap items-end gap-3" onSubmit={upload}>
            <label className="flex flex-col gap-1 text-sm">Rodzaj
              <select name="kind" className={input} value={uploadKind} onChange={event => setUploadKind(event.target.value)}>
                <option value="document">Dokument</option><option value="report">Sprawozdanie</option><option value="photo">Zdjęcie</option>
              </select>
            </label>
            <label className="flex min-w-0 flex-col gap-1 text-sm">{uploadKind === "photo" ? "Zdjęcie PNG lub JPEG" : "Plik PDF, DOCX lub TXT"}
              <input key={uploadKind} className="min-w-0 max-w-full py-2" type="file" name="file"
                accept={uploadKind === "photo" ? ".png,.jpg,.jpeg" : ".pdf,.docx,.txt"} required/>
            </label>
            <button className={button} disabled={busy}>Prześlij plik</button>
          </form>
          <AttachRecords organizationId={organizationId} investmentId={investmentId} investmentName={panel.investment.name} onAttached={() => setRevision(value => value + 1)}/>
        </Section>}
        <InvestmentTimeline panel={panel}/>
        <Finance organizationId={organizationId} investmentId={investmentId}/>
        <Section title="Agenci">
          <div className="flex flex-wrap gap-2">
            <Link className={button} href={"/chat?" + new URLSearchParams({ organizationId, investmentId })}>General Agent</Link>
            <Link className={button} href={"/chat?" + new URLSearchParams({ organizationId, investmentId, focus: "finance" })}>Przygotuj pytanie dla Financial Agenta</Link>
          </div>
        </Section>
      </>}
    </div>
  </main>;
}

export default function InvestmentPage() {
  const { id, investmentId } = useParams();
  return <InvestmentPanel key={JSON.stringify([id, investmentId])} organizationId={id} investmentId={investmentId}/>;
}
