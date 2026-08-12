"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import Navbar from "./components/Navbar";
import UserMenu from "./components/UserMenu";
import FileUpload from "./components/FileUpload";

import { getExecutiveDashboard } from "@/lib/api";

export default function HomePage() {

    const [dashboard, setDashboard] = useState(null);

    useEffect(() => {

        async function loadDashboard() {

            try {

                const data = await getExecutiveDashboard();

                setDashboard(data.dashboard);

            }
            catch (err) {

                console.error(err);

            }

        }

        loadDashboard();

    }, []);

    const summary = dashboard?.summary || {

        openTasks: 0,
        completedTasks: 0,
        highPriorityTasks: 0,
        overdueTasks: 0,
        documents: 0,
        meetings: 0

    };

    return (

        <main className="min-h-screen bg-slate-100">

            <div className="mx-auto max-w-7xl p-8">

                <UserMenu />

                <Navbar />

                <div className="mb-8 rounded-3xl bg-gradient-to-r from-blue-700 to-violet-700 p-10 text-white shadow-xl">

                    <h1 className="text-4xl font-bold">

                        🧠 Executive Dashboard

                    </h1>

                    <p className="mt-3 text-lg opacity-90">

                        Twój osobisty AI Executive Assistant

                    </p>

                </div>

                <div className="mb-8 grid gap-4 md:grid-cols-3 lg:grid-cols-6">

                    <StatCard
                        icon="📌"
                        value={summary.openTasks}
                        title="Otwarte"
                    />

                    <StatCard
                        icon="✅"
                        value={summary.completedTasks}
                        title="Wykonane"
                    />

                    <StatCard
                        icon="🔥"
                        value={summary.highPriorityTasks}
                        title="High Priority"
                    />

                    <StatCard
                        icon="⏰"
                        value={summary.overdueTasks}
                        title="Po terminie"
                    />

                    <StatCard
                        icon="📄"
                        value={summary.documents}
                        title="Dokumenty"
                    />

                    <StatCard
                        icon="🎤"
                        value={summary.meetings}
                        title="Spotkania"
                    />

                </div>

                <div className="mb-8 rounded-3xl bg-white p-8 shadow">

                    <div className="mb-5 flex items-center gap-3">

                        <div className="text-3xl">

                            🧠

                        </div>

                        <h2 className="text-2xl font-bold">

                            Executive Briefing

                        </h2>

                    </div>

                    <div className="whitespace-pre-wrap leading-8 text-slate-700">

                        {

                            dashboard?.briefing ||

                            "Trwa przygotowywanie briefingu..."

                        }

                    </div>

                </div>

                <div className="mb-8 grid gap-4 md:grid-cols-4">

                    <QuickLink
                        href="/document"
                        icon="📄"
                        title="Dokumenty"
                    />

                    <QuickLink
                        href="/meeting"
                        icon="🎤"
                        title="Spotkania"
                    />

                    <QuickLink
                        href="/history"
                        icon="📂"
                        title="Historia"
                    />

                    <QuickLink
                        href="/tasks"
                        icon="✅"
                        title="Zadania"
                    />

                </div>

                <FileUpload />

            </div>

        </main>

    );

}

function StatCard({

    icon,
    value,
    title

}) {

    return (

        <div className="rounded-2xl bg-white p-6 shadow">

            <div className="text-3xl">

                {icon}

            </div>

            <div className="mt-3 text-3xl font-bold">

                {value}

            </div>

            <div className="text-slate-500">

                {title}

            </div>

        </div>

    );

}

function QuickLink({

    href,
    icon,
    title

}) {

    return (

        <Link
            href={href}
            className="rounded-2xl bg-white p-6 shadow transition hover:shadow-xl hover:-translate-y-1"
        >

            <div className="text-4xl">

                {icon}

            </div>

            <h2 className="mt-3 text-xl font-bold">

                {title}

            </h2>

        </Link>

    );

}