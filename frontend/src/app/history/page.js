"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import Navbar from "../components/Navbar";
import UserMenu from "../components/UserMenu";
import { parseHistoryListResponse, parseHistoryDeletionResponse } from "@/lib/historyDashboardPayload";

import {
    getHistory,
    deleteHistoryItem
} from "@/lib/api";

export default function HistoryPage() {

    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState(false);
    const [error, setError] = useState("");
    const [pendingId, setPendingId] = useState(null);
    const [search, setSearch] = useState("");
    const visibleItems = items.filter(item => `${item.title || ""} ${item.type || ""}`.toLocaleLowerCase("pl-PL").includes(search.trim().toLocaleLowerCase("pl-PL")));

    async function loadHistory() {

        setLoading(true);
        setLoadError(false);
        setError("");
        try {

            const data = await getHistory();

            setItems(parseHistoryListResponse(data));

        }
        catch (err) {

            setItems([]);
            setLoadError(true);
            setError(err?.message || "Nie udało się pobrać historii analiz.");

        }
        finally {

            setLoading(false);

        }

    }

    useEffect(() => {

        loadHistory();

    }, []);

    async function remove(id) {

        if (pendingId || !window.confirm("Usunąć analizę?")) {

            return;

        }

        setPendingId(id);
        setError("");
        try {

            const response = await deleteHistoryItem(id);
            parseHistoryDeletionResponse(response);

            setItems(current =>
                current.filter(item => item.id !== id)
            );

        }
        catch (err) {

            setError(err?.message || "Nie udało się usunąć analizy.");

        }
        finally {

            setPendingId(null);

        }

    }

    return (

        <main className="min-h-screen min-w-0 overflow-x-clip bg-[#080e20] text-slate-100">

            <div className="mx-auto w-full min-w-0 max-w-7xl px-3 py-5 sm:px-6 lg:px-8">

                <UserMenu />

                <Navbar />

                <div className="min-w-0 overflow-hidden rounded-3xl border border-white/10 bg-[#111c35] p-4 shadow-lg sm:p-8">

                    <div className="flex flex-wrap items-center justify-between gap-4">

                        <div>

                            <h1 className="text-2xl font-bold sm:text-3xl">

                                Historia analiz

                            </h1>

                            <p className="mt-2 text-slate-400">

                                Przeglądaj wcześniejsze analizy dokumentów i spotkań.

                            </p>

                        </div>

                        <div role="status" aria-label="Liczba zapisanych analiz" className="rounded-xl bg-violet-500/10 px-4 py-2 font-semibold text-violet-200">

                            {loading || loadError ? "—" : items.length}

                        </div>

                    </div>

                    {error && <p role="alert" className="mt-6 rounded-xl border border-rose-400/20 bg-rose-400/10 p-4 text-rose-200">{error}</p>}

                    {loading && (

                        <div className="mt-10 text-slate-300">

                            Ładowanie...

                        </div>

                    )}

                    {!loading && loadError && (

                        <div className="mt-10 text-slate-300">Historia analiz jest chwilowo niedostępna. <button type="button" onClick={loadHistory} className="font-semibold text-violet-300 underline">Spróbuj ponownie</button></div>

                    )}

                    {!loading && !loadError && items.length === 0 && (

                        <div className="mt-10 rounded-2xl border-2 border-dashed border-white/15 p-8 text-center sm:p-16">

                            <div className="text-6xl">

                                📂

                            </div>

                            <h2 className="mt-5 text-2xl font-bold">

                                Brak zapisanych analiz

                            </h2>

                        </div>

                    )}

                    {!loading && !loadError && items.length > 0 && (
                        <label className="mt-7 block text-sm font-medium text-slate-200">Szukaj w historii
                            <input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Nazwa dokumentu lub rodzaj analizy" className="mt-2 block w-full min-w-0 rounded-xl border border-white/20 bg-[#0b152b] px-4 py-3 text-white outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-400/15" />
                        </label>
                    )}

                    {!loading && !loadError && items.length > 0 && visibleItems.length === 0 && <p role="status" className="mt-6 rounded-xl bg-white/5 p-5 text-slate-300">Brak wyników dla podanej frazy.</p>}

                    {!loading && !loadError && visibleItems.length > 0 && (

                        <div className="mt-8 space-y-4">

                            {visibleItems.map(item => (

                                <div
                                    key={item.id}
                                    className="flex min-w-0 flex-col gap-4 rounded-2xl border border-white/10 bg-[#15233e] p-4 transition hover:bg-white/[.05] sm:flex-row sm:items-center sm:justify-between sm:p-6"
                                >

                                    <div>

                                        <h2 className="break-words text-lg font-semibold">

                                            {item.title}

                                        </h2>

                                        <p className="mt-1 text-slate-400">

                                            {item.type}

                                        </p>

                                        <p className="mt-1 text-sm text-slate-400">

                                            {new Date(item.createdAt).toLocaleString("pl-PL")}

                                        </p>

                                    </div>

                                    <div className="flex flex-wrap gap-3">

                                        <Link
                                            href={`/history/${item.id}`}
                                            className="inline-flex items-center justify-center rounded-xl bg-violet-600 px-5 py-3 text-sm font-medium text-white hover:bg-violet-500"
                                        >

                                            Otwórz

                                        </Link>

                                        <button
                                            type="button"
                                            disabled={pendingId !== null}
                                            aria-label={`Usuń analizę: ${item.title}`}
                                            onClick={() => remove(item.id)}
                                            className="rounded-xl border border-rose-400/25 px-5 py-3 text-sm text-rose-200 hover:bg-rose-400/10 disabled:opacity-50"
                                        >

                                            Usuń

                                        </button>

                                    </div>

                                </div>

                            ))}

                        </div>

                    )}

                </div>

            </div>

        </main>

    );

}