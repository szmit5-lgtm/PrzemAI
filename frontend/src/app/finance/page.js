"use client";

import { useEffect, useState } from "react";
import {
    getFinancialDocuments,
    getFinanceSummary
} from "@/lib/api";

export default function FinancePage() {
    const [items, setItems] = useState([]);
    const [summary, setSummary] = useState({
        total: 0,
        new: 0,
        mail: 0,
        ksef: 0
    });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    async function load() {
        try {
            setError("");

            const [documentsResponse, summaryResponse] =
                await Promise.all([
                    getFinancialDocuments({
                        limit: 200
                    }),
                    getFinanceSummary()
                ]);

            setItems(
                documentsResponse.items || []
            );

            setSummary(
                summaryResponse.data || {}
            );
        }
        catch (err) {
            setError(err.message);
        }
        finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        load();
    }, []);

    return (
        <main className="min-h-screen bg-slate-100 p-8">
            <div className="mx-auto max-w-7xl space-y-8">
                <section>
                    <h1 className="text-3xl font-bold">
                        Finanse
                    </h1>

                    <p className="mt-2 text-slate-500">
                        Dokumenty zebrane przez Financial Agent.
                    </p>

                    <div className="mt-6 grid gap-4 md:grid-cols-4">
                        <Stat label="Wszystkie" value={summary.total || 0} />
                        <Stat label="Nowe" value={summary.new || 0} />
                        <Stat label="Z maila" value={summary.mail || 0} />
                        <Stat label="KSeF" value={summary.ksef || 0} />
                    </div>
                </section>

                <section className="rounded-3xl bg-white p-6 shadow-sm">
                    {error && (
                        <div className="mb-4 rounded-xl bg-red-50 p-4 text-red-700">
                            {error}
                        </div>
                    )}

                    {loading ? (
                        <p className="text-slate-500">
                            Ładowanie...
                        </p>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="min-w-full text-sm">
                                <thead>
                                    <tr className="border-b text-left text-slate-500">
                                        <th className="p-3">Data</th>
                                        <th className="p-3">Źródło</th>
                                        <th className="p-3">Dokument</th>
                                        <th className="p-3">Kontrahent</th>
                                        <th className="p-3">Brutto</th>
                                        <th className="p-3">Termin</th>
                                        <th className="p-3">Projekt</th>
                                        <th className="p-3">Status</th>
                                    </tr>
                                </thead>

                                <tbody>
                                    {items.map(item => (
                                        <tr
                                            key={item.id}
                                            className="border-b"
                                        >
                                            <td className="p-3">
                                                {formatDate(item.issueDate)}
                                            </td>

                                            <td className="p-3">
                                                {item.source}
                                            </td>

                                            <td className="p-3">
                                                {item.invoiceNumber ||
                                                    item.ksefNumber ||
                                                    item.rawData?.filename ||
                                                    "-"}
                                            </td>

                                            <td className="p-3">
                                                {item.sellerName ||
                                                    item.rawData?.from ||
                                                    "-"}
                                            </td>

                                            <td className="p-3">
                                                {item.grossAmount
                                                    ? `${item.grossAmount} ${item.currency}`
                                                    : "-"}
                                            </td>

                                            <td className="p-3">
                                                {formatDate(item.dueDate)}
                                            </td>

                                            <td className="p-3">
                                                {item.project?.name || "-"}
                                            </td>

                                            <td className="p-3">
                                                {item.status}
                                            </td>
                                        </tr>
                                    ))}

                                    {!items.length && (
                                        <tr>
                                            <td
                                                colSpan={8}
                                                className="p-8 text-center text-slate-500"
                                            >
                                                Brak dokumentów finansowych.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                </section>
            </div>
        </main>
    );
}

function Stat({ label, value }) {
    return (
        <div className="rounded-2xl bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">
                {label}
            </p>

            <p className="mt-2 text-3xl font-bold">
                {value}
            </p>
        </div>
    );
}

function formatDate(value) {
    if (!value) {
        return "-";
    }

    return new Date(value).toLocaleDateString(
        "pl-PL"
    );
}
