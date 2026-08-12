"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import Navbar from "../components/Navbar";
import UserMenu from "../components/UserMenu";

import {
    getHistory,
    deleteHistoryItem
} from "@/lib/api";

export default function HistoryPage() {

    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);

    async function loadHistory() {

        try {

            const data = await getHistory();

            setItems(data.items || []);

        }
        catch (err) {

            alert(err.message);

        }
        finally {

            setLoading(false);

        }

    }

    useEffect(() => {

        loadHistory();

    }, []);

    async function remove(id) {

        if (!confirm("Usunąć analizę?")) {

            return;

        }

        try {

            await deleteHistoryItem(id);

            setItems(current =>
                current.filter(item => item.id !== id)
            );

        }
        catch (err) {

            alert(err.message);

        }

    }

    return (

        <main className="min-h-screen bg-slate-100">

            <div className="mx-auto max-w-7xl p-8">

                <UserMenu />

                <Navbar />

                <div className="rounded-3xl border bg-white p-10 shadow-sm">

                    <div className="flex items-center justify-between">

                        <div>

                            <h1 className="text-3xl font-bold">

                                Historia analiz

                            </h1>

                            <p className="mt-2 text-slate-500">

                                Wszystkie zapisane analizy.

                            </p>

                        </div>

                        <div className="rounded-xl bg-slate-100 px-4 py-2 font-semibold">

                            {items.length}

                        </div>

                    </div>

                    {loading && (

                        <div className="mt-10">

                            Ładowanie...

                        </div>

                    )}

                    {!loading && items.length === 0 && (

                        <div className="mt-10 rounded-2xl border-2 border-dashed p-16 text-center">

                            <div className="text-6xl">

                                📂

                            </div>

                            <h2 className="mt-5 text-2xl font-bold">

                                Brak zapisanych analiz

                            </h2>

                        </div>

                    )}

                    {!loading && items.length > 0 && (

                        <div className="mt-8 space-y-4">

                            {items.map(item => (

                                <div
                                    key={item.id}
                                    className="flex items-center justify-between rounded-2xl border p-6 hover:bg-slate-50 transition"
                                >

                                    <div>

                                        <h2 className="text-lg font-semibold">

                                            {item.title}

                                        </h2>

                                        <p className="mt-1 text-slate-500">

                                            {item.type}

                                        </p>

                                        <p className="mt-1 text-sm text-slate-400">

                                            {new Date(item.createdAt).toLocaleString("pl-PL")}

                                        </p>

                                    </div>

                                    <div className="flex gap-3">

                                        <Link
                                            href={`/history/${item.id}`}
                                            className="rounded-xl bg-blue-600 px-5 py-3 font-medium text-white hover:bg-blue-700"
                                        >

                                            Otwórz

                                        </Link>

                                        <button
                                            onClick={() => remove(item.id)}
                                            className="rounded-xl border border-red-500 px-5 py-3 text-red-600 hover:bg-red-50"
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