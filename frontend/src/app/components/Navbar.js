"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useVerifiedProfile } from "./AuthGuard";
import {
  LayoutDashboard, MessageSquare, FileText, Mic, History, CheckSquare,
  Brain, Settings, Bot, Wallet, Handshake, Building2, ShieldCheck,
  Menu, X, BriefcaseBusiness, Search, Bell
} from "lucide-react";

const links = [
  {href:"/",label:"Pulpit",icon:LayoutDashboard},
  {href:"/raport-wlasciciela",label:"Raport i alerty",icon:Bell},
  {href:"/chat",label:"Asystent AI",icon:MessageSquare},
  {href:"/agents",label:"Agenci",icon:Bot},
  {href:"/finance",label:"Finanse",icon:Wallet},
  {href:"/agents/sales",label:"Sprzedaż",icon:Handshake},
  {href:"/company/setup",label:"Spółki",icon:Building2},
  {href:"/document",label:"Dokumenty",icon:FileText},
  {href:"/meeting",label:"Spotkania",icon:Mic},
  {href:"/tasks",label:"Zadania",icon:CheckSquare},
  {href:"/history",label:"Historia",icon:History},
  {href:"/search",label:"Szukaj",icon:Search},
  {href:"/memory",label:"Pamięć AI",icon:Brain},
  {href:"/settings",label:"Ustawienia",icon:Settings},
  {href:"/administracja",label:"Administracja",icon:ShieldCheck}
];
const mobilePrimary = ["/", "/chat", "/finance"];
const isActive = (pathname, href) => href === "/"
  ? pathname === "/"
  : href === "/agents"
    ? pathname === "/agents" || (pathname.startsWith("/agents/") && !pathname.startsWith("/agents/sales"))
    : pathname === href || pathname.startsWith(href + "/");

export default function Navbar({ vertical = false, organizationId = null, investmentOrganizationId = organizationId }) {
  const pathname = usePathname() || "/";
  const [mobileOpen, setMobileOpen] = useState(false);
  const profile = useVerifiedProfile();
  const showAdministration = profile?.email.trim().toLowerCase() === "p.szmitkowski@dekonica.com";
  useEffect(() => { setMobileOpen(false); }, [pathname]);
  useEffect(() => {
    if (!mobileOpen) return;
    const onKeyDown = event => {
      if (event.key === "Escape") setMobileOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [mobileOpen]);
  // A company page (or a company selected on the dashboard) must never send
  // the Documents link to the personal /document upload screen.
  const companyMatch = /^\/company\/([^/]+)(?:\/|$)/.exec(pathname);
  const companySegment = companyMatch?.[1] !== "setup" ? companyMatch?.[1] : null;
  const documentsHref = companySegment
    ? "/company/" + companySegment + "/documents"
    : organizationId ? "/company/" + encodeURIComponent(organizationId) + "/documents" : "/document";
  const investmentCompany = companySegment || (investmentOrganizationId && encodeURIComponent(investmentOrganizationId));
  const investmentsHref = investmentCompany ? "/company/" + investmentCompany + "/investments" : "/company/setup";
  const investmentLink = { href: investmentsHref, label: "Inwestycje", icon: BriefcaseBusiness };
  const visible = links
    .filter(link => link.href !== "/administracja" || showAdministration)
    .map(link => link.href === "/document" && documentsHref !== "/document"
      ? { ...link, href: documentsHref, label: "Dokumenty spółki" } : link);
  const primaryLinks = [...visible.filter(link => mobilePrimary.includes(link.href)), investmentLink];
  const dark = pathname === "/" || ["/finance","/agents","/tasks","/chat","/document","/meeting","/history","/memory","/settings","/company","/administracja"].some(prefix => pathname === prefix || pathname.startsWith(prefix + "/"));

  const navLink = ({ href, label, icon: Icon }, compact = false) => {
    const active = isActive(pathname, href);
    return <Link key={href} href={href} aria-current={active ? "page" : undefined}
      onClick={() => setMobileOpen(false)}
      className={compact
        ? `flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl px-1 text-[10px] font-semibold ${active ? "bg-violet-600/20 text-violet-200" : "text-slate-300 hover:bg-white/10"}`
        : `inline-flex min-h-11 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors ${active
          ? "bg-violet-600 text-white shadow-sm shadow-violet-900/30"
          : dark ? "text-slate-200 hover:bg-white/10" : "text-slate-700 hover:bg-slate-100"}`}>
      <Icon size={compact ? 20 : 18} aria-hidden="true" className="shrink-0"/>
      <span>{label}</span>
    </Link>;
  };
  if (vertical) {
    return <nav aria-label="Nawigacja główna" className="flex flex-col gap-1">
      {visible.map(link => navLink(link))}
    </nav>;
  }
  return <>
    <nav aria-label="Nawigacja główna na dużym ekranie"
      className={`mt-4 mb-6 hidden flex-wrap gap-1 rounded-2xl p-2 lg:flex ${dark ? "border border-white/10 bg-[#111c35]" : "border border-slate-200 bg-white"}`}>
      {visible.map(link => navLink(link))}
    </nav>
    <nav aria-label="Nawigacja mobilna" className="fixed inset-x-0 bottom-0 z-50 border-t border-white/15 bg-[#0b1530]/95 px-2 pb-[max(8px,env(safe-area-inset-bottom))] pt-2 text-white shadow-[0_-12px_32px_rgba(0,0,0,.3)] backdrop-blur-xl lg:hidden">
      <div className="mx-auto grid max-w-lg grid-cols-5 gap-1">
        {primaryLinks.map(link => navLink(link, true))}
        <button type="button" aria-expanded={mobileOpen} aria-controls="przemai-more-navigation"
          aria-label={mobileOpen ? "Zamknij więcej opcji" : "Więcej opcji"}
          onClick={() => setMobileOpen(value => !value)}
          className={`flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl px-1 text-[10px] font-semibold ${mobileOpen || visible.some(link => !mobilePrimary.includes(link.href) && isActive(pathname, link.href)) ? "bg-violet-600/20 text-violet-200" : "text-slate-300"}`}>
          {mobileOpen ? <X size={20}/> : <Menu size={20}/>}<span>Więcej</span>
        </button>
      </div>
    </nav>
    {mobileOpen && <button type="button" aria-label="Zamknij menu" className="fixed inset-0 z-40 bg-slate-950/60 lg:hidden" onClick={() => setMobileOpen(false)} />}
    {mobileOpen && <div id="przemai-more-navigation" className="fixed inset-x-3 bottom-[calc(76px+env(safe-area-inset-bottom))] z-50 max-h-[min(65vh,520px)] overflow-y-auto rounded-2xl border border-white/15 bg-[#111c35] p-3 text-white shadow-2xl lg:hidden">
      <div className="mb-2 flex items-center justify-between px-2">
        <strong className="text-sm">Pozostałe moduły</strong>
        <button type="button" onClick={() => setMobileOpen(false)} aria-label="Zamknij menu" className="rounded-lg p-2 hover:bg-white/10"><X size={18}/></button>
      </div>
      <nav aria-label="Pozostałe moduły" className="grid grid-cols-2 gap-1">
        {visible.filter(link => !mobilePrimary.includes(link.href)).map(link => navLink(link))}
      </nav>
    </div>}
  </>;
}
