"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, MessageSquare, FileText, Mic, History, CheckSquare, Brain, Settings, Bot, Wallet } from "lucide-react";

const links = [
  { href: "/", label: "Pulpit", icon: LayoutDashboard },
  { href: "/chat", label: "Asystent AI", icon: MessageSquare },
  { href: "/agents", label: "Agenci", icon: Bot },
  { href: "/finance", label: "Finanse", icon: Wallet },
  { href: "/document", label: "Dokumenty", icon: FileText },
  { href: "/meeting", label: "Spotkania", icon: Mic },
  { href: "/tasks", label: "Zadania", icon: CheckSquare },
  { href: "/history", label: "Historia", icon: History },
  { href: "/memory", label: "Pamięć", icon: Brain },
  { href: "/settings", label: "Ustawienia", icon: Settings }
];

export default function Navbar({ vertical = false }) {
  const pathname = usePathname();
  const dark = ["/", "/finance", "/agents", "/tasks"].includes(pathname);
  return (
    <nav aria-label="Nawigacja główna" className={vertical ? "flex flex-col gap-2" : `mt-4 flex gap-2 overflow-x-auto pb-2 ${dark ? "" : "mb-6"}`}>
      {links.map(({ href, label, icon: Icon }) => {
        const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
        return (
          <Link key={href} href={href} aria-current={active ? "page" : undefined}
            className={`inline-flex shrink-0 items-center gap-2 rounded-xl px-3 py-2.5 text-xs font-semibold transition sm:text-sm ${active
              ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20"
              : dark
                ? "border border-white/10 bg-white/5 text-slate-200 hover:border-cyan-400/40 hover:bg-white/10"
                : "border border-slate-200 bg-white text-slate-700 hover:border-blue-300 hover:bg-blue-50"}`}>
            <Icon size={16} aria-hidden="true" />{label}
          </Link>
        );
      })}
    </nav>
  );
}
