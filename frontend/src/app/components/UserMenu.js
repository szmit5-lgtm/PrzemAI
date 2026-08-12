"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
    Bell,
    LogOut,
    Search,
    Sparkles,
    UserCircle2,
    CheckSquare
} from "lucide-react";

import {
    getProfile,
    getTasks
} from "@/lib/api";

export default function UserMenu() {

    const [user, setUser] = useState(null);
    const [taskCount, setTaskCount] = useState(0);

    useEffect(() => {

        async function load() {

            try {

                const [profile, tasks] = await Promise.all([
                    getProfile(),
                    getTasks()
                ]);

                setUser(profile.user);
                setTaskCount(tasks.items?.length || 0);

            } catch {

                localStorage.removeItem("token");
                window.location.href = "/login";

            }

        }

        load();

    }, []);

    function logout() {

        localStorage.removeItem("token");
        window.location.href = "/login";

    }

    if (!user) {

        return null;

    }

    return (

        <header className="glass mb-8">

            <div className="flex flex-col gap-6 p-8 lg:flex-row lg:items-center lg:justify-between">

                <div>

                    <p className="text-sm font-semibold uppercase tracking-[0.25em] text-blue-600">

                        Executive Workspace

                    </p>

                    <h1 className="mt-2 text-4xl font-bold">

                        Witaj ponownie 👋

                    </h1>

                    <p className="mt-2 text-slate-500">

                        Zarządzaj dokumentami, spotkaniami, historią i zadaniami.

                    </p>

                </div>

                <div className="flex flex-col gap-4 lg:items-end">

                    <div className="flex items-center gap-3">

                        <button className="flex h-12 w-12 items-center justify-center rounded-2xl border bg-white hover:bg-slate-100">

                            <Search size={20} />

                        </button>

                        <button className="relative flex h-12 w-12 items-center justify-center rounded-2xl border bg-white hover:bg-slate-100">

                            <Bell size={20} />

                            <span className="absolute right-3 top-3 h-2 w-2 rounded-full bg-red-500"></span>

                        </button>

                        <Link
                            href="/tasks"
                            className="flex items-center gap-2 rounded-2xl border bg-white px-4 py-3 hover:bg-slate-100"
                        >

                            <CheckSquare size={18} />

                            <span>{taskCount}</span>

                        </Link>

                    </div>

                    <div className="flex items-center gap-4 rounded-2xl bg-white px-5 py-4 shadow-sm">

                        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-violet-600 text-white">

                            <UserCircle2 size={32} />

                        </div>

                        <div>

                            <div className="font-semibold">

                                {user.email}

                            </div>

                            <div className="mt-1 flex items-center gap-2 text-sm text-slate-500">

                                <Sparkles size={15} />

                                {user.role}

                            </div>

                        </div>

                        <button
                            onClick={logout}
                            className="ml-4 flex items-center gap-2 rounded-xl bg-red-600 px-4 py-3 font-medium text-white hover:bg-red-700"
                        >

                            <LogOut size={18} />

                            Wyloguj

                        </button>

                    </div>

                </div>

            </div>

        </header>

    );

}