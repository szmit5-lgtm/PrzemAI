"use client";

import { useEffect, useState } from "react";
import {
    getAgents,
    runAgent,
    setAgentEnabled,
    getIntegrations,
    setIntegrationEnabled
} from "@/lib/api";

export default function AgentsPage() {
    const [agents, setAgents] = useState([]);
    const [integrations, setIntegrations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    async function load() {
        try {
            setError("");

            const [agentsResponse, integrationsResponse] =
                await Promise.all([
                    getAgents(),
                    getIntegrations()
                ]);

            setAgents(agentsResponse.data || []);
            setIntegrations(integrationsResponse.data || []);
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

    async function run(id) {
        try {
            await runAgent(id);
            await load();
        }
        catch (err) {
            setError(err.message);
        }
    }

    async function toggleAgent(agent) {
        try {
            await setAgentEnabled(
                agent.id,
                !agent.enabled
            );

            await load();
        }
        catch (err) {
            setError(err.message);
        }
    }

    async function toggleIntegration(integration) {
        try {
            await setIntegrationEnabled(
                integration.id,
                !integration.enabled
            );

            await load();
        }
        catch (err) {
            setError(err.message);
        }
    }

    return (
        <main className="min-h-screen bg-slate-100 p-8">
            <div className="mx-auto max-w-6xl space-y-8">
                <section className="rounded-3xl bg-white p-8 shadow-sm">
                    <h1 className="text-3xl font-bold">
                        Agenci
                    </h1>

                    {error && (
                        <div className="mt-4 rounded-xl bg-red-50 p-4 text-red-700">
                            {error}
                        </div>
                    )}

                    {loading ? (
                        <p className="mt-8 text-slate-500">
                            Ładowanie...
                        </p>
                    ) : (
                        <div className="mt-8 space-y-4">
                            {agents.map(agent => (
                                <div
                                    key={agent.id}
                                    className="rounded-2xl border p-5"
                                >
                                    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                                        <div>
                                            <h2 className="text-xl font-semibold">
                                                {agent.name}
                                            </h2>

                                            <p className="mt-2 text-sm text-slate-500">
                                                Status: {agent.status}
                                            </p>

                                            <p className="text-sm text-slate-500">
                                                Aktywny: {agent.enabled ? "tak" : "nie"}
                                            </p>

                                            <p className="text-sm text-slate-500">
                                                Interwał: {agent.intervalMinutes} min
                                            </p>
                                        </div>

                                        <div className="flex gap-3">
                                            <button
                                                onClick={() => run(agent.id)}
                                                className="rounded-xl bg-blue-600 px-4 py-2 text-white"
                                            >
                                                Uruchom teraz
                                            </button>

                                            <button
                                                onClick={() => toggleAgent(agent)}
                                                className="rounded-xl border px-4 py-2"
                                            >
                                                {agent.enabled ? "Wyłącz" : "Włącz"}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </section>

                <section className="rounded-3xl bg-white p-8 shadow-sm">
                    <h2 className="text-2xl font-bold">
                        Integracje
                    </h2>

                    <div className="mt-6 space-y-4">
                        {integrations.map(integration => (
                            <div
                                key={integration.id}
                                className="rounded-2xl border p-5"
                            >
                                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                                    <div>
                                        <h3 className="text-lg font-semibold">
                                            {integration.name}
                                        </h3>

                                        <p className="mt-1 text-sm text-slate-500">
                                            {integration.provider} / {integration.type}
                                        </p>

                                        <p className="text-sm text-slate-500">
                                            Status: {integration.enabled ? "aktywna" : "wyłączona"}
                                        </p>

                                        <p className="text-sm text-slate-500">
                                            Ostatnia synchronizacja:{" "}
                                            {integration.lastSyncAt
                                                ? new Date(integration.lastSyncAt).toLocaleString("pl-PL")
                                                : "brak"}
                                        </p>
                                    </div>

                                    <button
                                        onClick={() => toggleIntegration(integration)}
                                        className="rounded-xl border px-4 py-2"
                                    >
                                        {integration.enabled ? "Wyłącz" : "Włącz"}
                                    </button>
                                </div>
                            </div>
                        ))}

                        {!integrations.length && !loading && (
                            <p className="text-slate-500">
                                Brak integracji.
                            </p>
                        )}
                    </div>
                </section>
            </div>
        </main>
    );
}
