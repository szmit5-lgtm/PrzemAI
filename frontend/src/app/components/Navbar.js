"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import {
    LayoutDashboard,
    MessageSquare,
    FileText,
    Mic,
    History,
    CheckSquare,
    Brain,
    Settings
} from "lucide-react";

const links = [

    {
        href: "/",
        label: "Executive",
        icon: LayoutDashboard
    },

    {
        href: "/chat",
        label: "AI Chat",
        icon: MessageSquare
    },

    {
        href: "/document",
        label: "Dokumenty",
        icon: FileText
    },

    {
        href: "/meeting",
        label: "Spotkania",
        icon: Mic
    },

    {
        href: "/history",
        label: "Historia",
        icon: History
    },

    {
        href: "/tasks",
        label: "Zadania",
        icon: CheckSquare
    },

    {
        href: "/memory",
        label: "Pamięć",
        icon: Brain
    },

    {
        href: "/settings",
        label: "Ustawienia",
        icon: Settings
    }

];

export default function Navbar() {

    const pathname = usePathname();

    return (

        <nav className="mb-8 flex flex-wrap gap-3">

            {links.map(link => {

                const Icon = link.icon;

                const active =
                    link.href === "/"
                        ? pathname === "/"
                        : pathname.startsWith(link.href);

                return (

                    <Link
                        key={link.href}
                        href={link.href}
                        className={`flex items-center gap-3 rounded-xl px-5 py-3 font-medium transition ${
                            active
                                ? "bg-blue-600 text-white shadow-lg"
                                : "border bg-white hover:bg-slate-100"
                        }`}
                    >

                        <Icon size={18} />

                        {link.label}

                    </Link>

                );

            })}

        </nav>

    );

}