"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, Clock3, ListTodo, Plus, RefreshCw, Trash2 } from "lucide-react";
import Navbar from "../components/Navbar";
import UserMenu from "../components/UserMenu";
import { getTasks, createTask, deleteTask, completeTask } from "@/lib/api";

const emptyForm = { title: "", description: "", priority: "MEDIUM", dueDate: "" };
const priorityLabels = { LOW: "Niski", MEDIUM: "Średni", HIGH: "Wysoki" };
const priorityColors = {
  LOW: "border-slate-400/25 bg-slate-400/10 text-slate-200",
  MEDIUM: "border-amber-400/25 bg-amber-400/10 text-amber-200",
  HIGH: "border-rose-400/25 bg-rose-400/10 text-rose-200"
};

function displayDate(value) {
  if (!value) return "Bez terminu";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Bez terminu" : date.toLocaleDateString("pl-PL");
}

export default function TasksPage() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pendingId, setPendingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function loadTasks() {
    setLoading(true);
    setError("");
    try {
      const data = await getTasks();
      setTasks(Array.isArray(data?.items) ? data.items : []);
    } catch (err) {
      setError(err?.message || "Nie udało się pobrać zadań.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadTasks(); }, []);

  async function submit(event) {
    event.preventDefault();
    if (saving || !form.title.trim()) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const data = await createTask({ ...form, title: form.title.trim() });
      if (!data?.item) throw new Error("Nie otrzymano potwierdzenia utworzenia zadania.");
      setTasks(current => [data.item, ...current]);
      setForm(emptyForm);
      setNotice("Zadanie zostało dodane.");
    } catch (err) {
      setError(err?.message || "Nie udało się dodać zadania.");
    } finally {
      setSaving(false);
    }
  }

  async function complete(id) {
    if (pendingId) return;
    setPendingId(id);
    setError("");
    setNotice("");
    try {
      const data = await completeTask(id);
      if (!data?.item) throw new Error("Nie otrzymano potwierdzenia wykonania zadania.");
      setTasks(current => current.map(task => task.id === id ? data.item : task));
      setNotice("Zadanie oznaczono jako wykonane.");
    } catch (err) {
      setError(err?.message || "Nie udało się ukończyć zadania.");
    } finally {
      setPendingId(null);
    }
  }

  async function remove(id) {
    if (pendingId || !window.confirm("Usunąć to zadanie?")) return;
    setPendingId(id);
    setError("");
    setNotice("");
    try {
      await deleteTask(id);
      setTasks(current => current.filter(task => task.id !== id));
      setNotice("Zadanie zostało usunięte.");
    } catch (err) {
      setError(err?.message || "Nie udało się usunąć zadania.");
    } finally {
      setPendingId(null);
    }
  }

  const openCount = tasks.filter(task => task.status !== "DONE").length;
  const completedCount = tasks.filter(task => task.status === "DONE").length;
  const busy = saving || Boolean(pendingId);

  return (
    <main className="min-h-screen bg-[#070e22] px-4 py-6 text-slate-100 sm:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/[.04] px-5 py-4">
          <Link href="/" className="inline-flex items-center gap-2 text-lg font-black"><ArrowLeft size={18} className="text-cyan-300" /> Przem<span className="-ml-2 text-cyan-300">AI</span></Link>
          <UserMenu />
        </header>
        <Navbar />
        <div className="mt-8 flex flex-wrap items-start justify-between gap-4">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-cyan-400/25 bg-cyan-400/10 px-3 py-1 text-xs font-bold text-cyan-200"><ListTodo size={14} /> TASK MANAGER</span>
            <h1 className="mt-4 text-3xl font-black sm:text-4xl">Moje zadania</h1>
            <p className="mt-3 text-sm leading-6 text-slate-300">Zaplanuj pracę, ustal priorytet i oznaczaj ukończone zadania.</p>
          </div>
          <button type="button" onClick={loadTasks} disabled={loading || busy} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-cyan-300/30 bg-cyan-300/10 px-5 py-3 text-sm font-bold text-cyan-100 transition hover:bg-cyan-300/20 disabled:opacity-50"><RefreshCw size={17} className={loading ? "animate-spin" : ""} /> Odśwież</button>
        </div>
        {error && <p role="alert" className="mt-6 rounded-xl border border-rose-400/30 bg-rose-400/10 p-4 text-sm text-rose-200">{error}</p>}
        {notice && !error && <p role="status" className="mt-6 rounded-xl border border-emerald-400/30 bg-emerald-400/10 p-4 text-sm text-emerald-200">{notice}</p>}
        <div className="mt-7 grid grid-cols-2 gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-white/[.05] p-5"><ListTodo size={20} className="text-cyan-300" /><p className="mt-3 text-3xl font-bold">{loading ? "—" : tasks.length}</p><p className="mt-1 text-sm text-slate-400">Wszystkie</p></div>
          <div className="rounded-2xl border border-white/10 bg-white/[.05] p-5"><Clock3 size={20} className="text-cyan-300" /><p className="mt-3 text-3xl font-bold">{loading ? "—" : openCount}</p><p className="mt-1 text-sm text-slate-400">Do zrobienia</p></div>
          <div className="col-span-2 rounded-2xl border border-white/10 bg-white/[.05] p-5 md:col-span-1"><CheckCircle2 size={20} className="text-emerald-300" /><p className="mt-3 text-3xl font-bold">{loading ? "—" : completedCount}</p><p className="mt-1 text-sm text-slate-400">Wykonane</p></div>
        </div>
        <div className="mt-7 grid items-start gap-6 lg:grid-cols-[minmax(300px,0.85fr)_minmax(0,1.4fr)]">
          <section className="rounded-3xl border border-cyan-400/15 bg-gradient-to-br from-[#14264b] to-[#0c1730] p-6 sm:p-7">
            <h2 className="flex items-center gap-2 text-xl font-bold"><Plus size={21} className="text-cyan-300" /> Nowe zadanie</h2>
            <form onSubmit={submit} className="mt-6 space-y-4">
              <label className="block text-sm font-semibold text-slate-200">Tytuł
                <input value={form.title} onChange={event => setForm(current => ({ ...current, title: event.target.value }))} required maxLength={250} placeholder="Co trzeba zrobić?" className="mt-2 block w-full rounded-xl border border-white/15 bg-slate-950/50 px-4 py-3 text-white outline-none placeholder:text-slate-500 focus:border-cyan-400" />
              </label>
              <label className="block text-sm font-semibold text-slate-200">Opis
                <textarea rows={4} value={form.description} onChange={event => setForm(current => ({ ...current, description: event.target.value }))} placeholder="Szczegóły (opcjonalnie)" className="mt-2 block w-full resize-y rounded-xl border border-white/15 bg-slate-950/50 px-4 py-3 text-white outline-none placeholder:text-slate-500 focus:border-cyan-400" />
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-sm font-semibold text-slate-200">Priorytet
                  <select value={form.priority} onChange={event => setForm(current => ({ ...current, priority: event.target.value }))} className="mt-2 block min-h-12 w-full rounded-xl border border-white/15 bg-[#101d3c] px-3 py-2 text-white outline-none focus:border-cyan-400"><option value="LOW">Niski</option><option value="MEDIUM">Średni</option><option value="HIGH">Wysoki</option></select>
                </label>
                <label className="block text-sm font-semibold text-slate-200">Termin
                  <input type="date" value={form.dueDate} onChange={event => setForm(current => ({ ...current, dueDate: event.target.value }))} className="mt-2 block min-h-12 w-full rounded-xl border border-white/15 bg-[#101d3c] px-3 py-2 text-white outline-none focus:border-cyan-400" />
                </label>
              </div>
              <button type="submit" disabled={saving || !form.title.trim()} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-cyan-400 px-5 py-3 font-bold text-slate-950 transition hover:bg-cyan-300 disabled:opacity-50"><Plus size={19} />{saving ? "Zapisywanie…" : "Dodaj zadanie"}</button>
            </form>
          </section>
          <section aria-labelledby="tasks-list-title" className="min-w-0 rounded-3xl border border-white/10 bg-white/[.045] p-5 sm:p-7">
            <h2 id="tasks-list-title" className="text-xl font-bold">Lista zadań</h2>
            {loading ? <p role="status" className="mt-7 text-sm text-slate-300">Pobieranie zadań…</p> : tasks.length === 0 ? (
              <div className="mt-6 rounded-2xl border border-dashed border-white/15 p-10 text-center"><CheckCircle2 size={36} className="mx-auto text-cyan-300" /><p className="mt-4 text-lg font-bold">Nie masz jeszcze zadań</p><p className="mt-2 text-sm text-slate-400">Dodaj pierwsze zadanie w formularzu obok.</p></div>
            ) : (
              <div className="mt-6 space-y-3">
                {tasks.map(task => (
                  <article key={task.id} className={`rounded-2xl border p-5 ${task.status === "DONE" ? "border-emerald-400/20 bg-emerald-400/[.05]" : "border-white/10 bg-slate-950/30"}`}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <h3 className={`break-words text-lg font-bold ${task.status === "DONE" ? "text-slate-300 line-through" : "text-white"}`}>{task.title}</h3>
                        {task.description && <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-slate-300">{task.description}</p>}
                        <div className="mt-4 flex flex-wrap gap-2 text-xs">
                          <span className={`rounded-lg border px-2.5 py-1 font-semibold ${priorityColors[task.priority] || priorityColors.MEDIUM}`}>{priorityLabels[task.priority] || task.priority || "—"}</span>
                          <span className="rounded-lg border border-white/10 bg-white/[.05] px-2.5 py-1 text-slate-300">{displayDate(task.dueDate)}</span>
                          <span className={`rounded-lg border px-2.5 py-1 ${task.status === "DONE" ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-200" : "border-cyan-400/25 bg-cyan-400/10 text-cyan-200"}`}>{task.status === "DONE" ? "Wykonane" : "Do zrobienia"}</span>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {task.status !== "DONE" && <button type="button" disabled={busy} onClick={() => complete(task.id)} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-emerald-500/15 px-3 py-2 text-xs font-bold text-emerald-200 transition hover:bg-emerald-500/25 disabled:opacity-50"><CheckCircle2 size={16} /> Wykonane</button>}
                        <button type="button" disabled={busy} onClick={() => remove(task.id)} aria-label={`Usuń zadanie: ${task.title}`} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-rose-400/25 px-3 py-2 text-xs font-bold text-rose-200 transition hover:bg-rose-400/10 disabled:opacity-50"><Trash2 size={16} /> Usuń</button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
