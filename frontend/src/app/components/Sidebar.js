"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import {
    LayoutDashboard,
    MessageSquare,
    FileText,
    Mic,
    Brain,
    History,
    Settings,
    CheckSquare
} from "lucide-react";

export default function Sidebar() {

    const pathname = usePathname();

    const items = [

        {
            href: "/",
            icon: LayoutDashboard,
            label: "Dashboard"
        },

        {
            href: "/chat",
            icon: MessageSquare,
            label: "Chat"
        },

        {
            href: "/document",
            icon: FileText,
            label: "Analiza"
        },

        {
            href: "/meeting",
            icon: Mic,
            label: "Spotkania"
        },

        {
            href: "/tasks",
            icon: CheckSquare,
            label: "Zadania"
        },

        {
            href: "/memory",
            icon: Brain,
            label: "Pamięć"
        },

        {
            href: "/history",
            icon: History,
            label: "Historia"
        },

        {
            href: "/settings",
            icon: Settings,
            label: "Ustawienia"
        }

    ];

    return (

        <aside className="w-72 h-screen bg-slate-950 text-white border-r border-slate-800 flex flex-col">

            <div className="p-8 border-b border-slate-800">

                <h1 className="text-3xl font-bold">
                    🧠 PrzemAI
                </h1>

                <p className="mt-2 text-sm text-slate-400">
                    Executive AI Assistant
                </p>

            </div>

            <div className="flex-1 p-4 space-y-2">

                {items.map(item => {

                    const Icon = item.icon;

                    const active =
                        item.href === "/"
                            ? pathname === "/"
                            : pathname.startsWith(item.href);

                    return (

                        <Link
                            key={item.href}
                            href={item.href}
                            className={`flex items-center gap-4 rounded-xl px-5 py-4 transition-all ${
                                active
                                    ? "bg-blue-600 shadow-lg"
                                    : "hover:bg-slate-800"
                            }`}
                        >

                            <Icon size={20} />

                            <span className="font-medium">

                                {item.label}

                            </span>

                        </Link>

                    );

                })}

            </div>

            <div className="border-t border-slate-800 p-5 text-xs text-slate-500">

                PrzemAI v2

            </div>

        </aside>

    );

}