"use client";

import { createTask } from "@/lib/api";

export default function ReportViewer({

    filename,
    report,
    onBack

}) {

    async function createFollowUpTask() {

        try {

            await createTask({

                title: `Działania po analizie: ${filename}`,
                description: JSON.stringify(report, null, 2),
                priority: "MEDIUM"

            });

            alert("Zadanie zostało utworzone.");

        } catch (err) {

            alert(err.message);

        }

    }

    function renderValue(value) {

        if (value === null || value === undefined) {

            return (
                <span className="text-slate-400">
                    Brak danych
                </span>
            );

        }

        if (Array.isArray(value)) {

            return (

                <ul className="space-y-3">

                    {value.map((item, index) => (

                        <li
                            key={index}
                            className="rounded-xl bg-slate-50 p-4"
                        >

                            {typeof item === "object"
                                ? renderValue(item)
                                : item}

                        </li>

                    ))}

                </ul>

            );

        }

        if (typeof value === "object") {

            return (

                <div className="space-y-4">

                    {Object.entries(value).map(([key, val]) => (

                        <div
                            key={key}
                            className="rounded-2xl border bg-white p-6"
                        >

                            <h3 className="mb-4 text-lg font-semibold capitalize">

                                {key.replaceAll("_", " ")}

                            </h3>

                            {renderValue(val)}

                        </div>

                    ))}

                </div>

            );

        }

        return (

            <p className="whitespace-pre-wrap leading-8 text-slate-700">

                {String(value)}

            </p>

        );

    }

    return (

        <main className="min-h-screen bg-slate-100">

            <div className="mx-auto max-w-6xl p-8">

                <div className="rounded-3xl bg-white p-10 shadow-sm">

                    <div className="flex items-center justify-between">

                        <div>

                            <div className="text-sm uppercase tracking-widest text-blue-600">

                                Executive Report

                            </div>

                            <h1 className="mt-2 text-3xl font-bold">

                                {filename}

                            </h1>

                        </div>

                        <div className="flex gap-3">

                            <button
                                onClick={createFollowUpTask}
                                className="rounded-xl bg-blue-600 px-5 py-3 text-white hover:bg-blue-700"
                            >

                                Utwórz zadanie

                            </button>

                            <button
                                onClick={onBack}
                                className="rounded-xl border px-5 py-3 hover:bg-slate-50"
                            >

                                Powrót

                            </button>

                        </div>

                    </div>

                </div>

                <div className="mt-6 rounded-3xl bg-white p-10 shadow-sm">

                    {renderValue(report)}

                </div>

            </div>

        </main>

    );

}