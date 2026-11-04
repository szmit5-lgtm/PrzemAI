"use client";

import { useState } from "react";
import { ArrowLeft, CheckCircle2, ClipboardList, FileText, LoaderCircle, ShieldAlert } from "lucide-react";
import { createTask } from "@/lib/api";

const PRIORITY = {
    HIGH: { label: "Wysoki", style: "bg-red-50 text-red-700" },
    MEDIUM: { label: "Średni", style: "bg-amber-50 text-amber-700" },
    LOW: { label: "Niski", style: "bg-slate-100 text-slate-600" }
};

function ListSection({ title, items, accent = "blue" }) {
    if (!Array.isArray(items) || items.length === 0) return null;
    const dot = accent === "red" ? "bg-red-500" : accent === "green" ? "bg-emerald-500" : "bg-blue-500";
    return (
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="mb-5 text-lg font-semibold text-slate-900">{title}</h2>
            <ul className="space-y-3">
                {items.map((item, index) => (
                    <li key={index} className="flex items-start gap-3 text-sm leading-7 text-slate-700">
                        <span aria-hidden="true" className={`mt-3 h-1.5 w-1.5 shrink-0 rounded-full ${dot}`} />
                        <span>{typeof item === "string" ? item : JSON.stringify(item)}</span>
                    </li>
                ))}
            </ul>
        </section>
    );
}

export default function ReportViewer({ filename, report, onBack }) {
    const [saving, setSaving] = useState(false);
    const data = report && typeof report === "object" && !Array.isArray(report) ? report : {};
    const tasks = Array.isArray(data.actionItems) ? data.actionItems.filter(item => item && typeof item.title === "string" && item.title.trim()) : [];
    const summary = typeof data.summary === "string" ? data.summary.trim() : "";
    const hasContent = summary || ["keyInformation", "dates", "risks", "recommendations"].some(key => Array.isArray(data[key]) && data[key].length) || tasks.length;

    async function createFollowUpTask() {
        if (saving || tasks.length === 0) return;
        setSaving(true);
        try {
            await createTask({
                title: `Działania po analizie: ${filename || "Dokument"}`,
                description: tasks.map((item, index) => `${index + 1}. ${item.title}${item.description ? " — " + item.description : ""}`).join("\n"),
                priority: tasks.some(item => item.priority === "HIGH") ? "HIGH" : "MEDIUM"
            });
            alert("Utworzono zadanie zbiorcze.");
        } catch (err) {
            alert(err?.message || "Nie udało się utworzyć zadania.");
        } finally {
            setSaving(false);
        }
    }

    return (
        <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-8">
            <div className="mx-auto max-w-5xl space-y-6">
                <header className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
                    <div className="mb-5 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-blue-700">
                        <FileText size={16} /> Raport z analizy dokumentu
                    </div>
                    <div className="flex flex-wrap items-start justify-between gap-5">
                        <div className="min-w-0 flex-1">
                            <h1 className="break-words text-2xl font-bold text-slate-950 sm:text-3xl">{filename || "Analiza dokumentu"}</h1>
                            <p className="mt-2 text-sm text-slate-500">Najważniejsze ustalenia, ryzyka i działania do wykonania.</p>
                        </div>
                        <button type="button" onClick={onBack} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
                            <ArrowLeft size={16} /> Powrót
                        </button>
                    </div>
                </header>

                {summary && (
                    <section className="rounded-3xl border border-blue-100 bg-blue-50 p-6 sm:p-8">
                        <p className="mb-3 text-xs font-bold uppercase tracking-wider text-blue-700">Podsumowanie zarządcze</p>
                        <p className="text-base leading-8 text-slate-900 sm:text-lg">{summary}</p>
                    </section>
                )}

                {!hasContent && (
                    <section className="rounded-2xl border border-slate-200 bg-white p-8 text-slate-600">
                        Brak danych do wyświetlenia w raporcie.
                    </section>
                )}

                <div className="grid gap-5 md:grid-cols-2">
                    <ListSection title="Kluczowe informacje" items={data.keyInformation} />
                    <ListSection title="Ważne terminy" items={data.dates} />
                    <ListSection title="Ryzyka i uwagi" items={data.risks} accent="red" />
                    <ListSection title="Rekomendacje" items={data.recommendations} accent="green" />
                </div>

                {tasks.length > 0 && (
                    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
                        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
                            <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
                                <ClipboardList size={20} className="text-blue-600" /> Działania do wykonania
                            </h2>
                            <button type="button" onClick={createFollowUpTask} disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60">
                                {saving ? <LoaderCircle size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                                {saving ? "Zapisywanie..." : "Utwórz zadanie"}
                            </button>
                        </div>
                        <ol className="space-y-3">
                            {tasks.map((task, index) => {
                                const priority = PRIORITY[task.priority] || PRIORITY.MEDIUM;
                                return (
                                    <li key={index} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                                        <div className="flex flex-wrap items-start justify-between gap-3">
                                            <div className="flex min-w-0 flex-1 items-start gap-3">
                                                <span className="mt-0.5 text-sm font-bold text-slate-400">{index + 1}.</span>
                                                <div>
                                                    <p className="font-semibold text-slate-900">{task.title}</p>
                                                    {task.description && <p className="mt-1 text-sm leading-6 text-slate-600">{task.description}</p>}
                                                    {task.dueDate && <p className="mt-2 text-xs text-slate-500">Termin: {task.dueDate}</p>}
                                                </div>
                                            </div>
                                            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${priority.style}`}>{priority.label}</span>
                                        </div>
                                    </li>
                                );
                            })}
                        </ol>
                    </section>
                )}
            </div>
        </main>
    );
}
