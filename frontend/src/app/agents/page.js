"use client";

import { useEffect, useState } from "react";
import { getAgents, runAgent, setAgentEnabled } from "@/lib/api";

export default function AgentsPage() {
    const [agents, setAgents] = useState([]);

    async function load() {
        const response = await getAgents();
        setAgents(response.data || []);
    }

    useEffect(() => {
        load();
    }, []);

    async function run(id) {
        await runAgent(id);
        await load();
    }

    async function toggle(agent) {
        await setAgentEnabled(agent.id, !agent.enabled);
        await load();
    }

    return (
        <main className="min-h-screen bg-slate-100 p-8">
            <div className="mx-auto max-w-6xl rounded-3xl bg-white p-8 shadow-sm">
                <h1 className="text-3xl font-bold">Agenci</h1>

                <div className="mt-8 space-y-4">
                    {agents.map(agent => (
                        <div
                            key={agent.id}
                            className="rounded-2xl border p-5"
                        >
                            <h2 className="text-xl font-semibold">
                                {agent.name}
                            </h2>

                            <p className="mt-2 text-sm text-slate-500">
                                Status: {agent.status}
                            </p>

                            <p className="text-sm text-slate-500">
                                Aktywny: {agent.enabled ? "tak" : "nie"}
                            </p>

                            <div className="mt-4 flex gap-3">
                                <button
                                    onClick={() => run(agent.id)}
                                    className="rounded-xl bg-blue-600 px-4 py-2 text-white"
                                >
                                    Uruchom teraz
                                </button>

                                <button
                                    onClick={() => toggle(agent)}
                                    className="rounded-xl border px-4 py-2"
                                >
                                    {agent.enabled ? "Wyłącz" : "Włącz"}
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </main>
    );
}
