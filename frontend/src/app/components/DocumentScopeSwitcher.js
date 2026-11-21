"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Building2, FolderOpen, ShieldCheck } from "lucide-react";
import { getOrganizations } from "@/lib/api";

// Every destination is a separate company-scoped URL, never a front-end-only filter.
export default function DocumentScopeSwitcher({ activeOrganizationId = null }) {
  const [companies, setCompanies] = useState([]);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    getOrganizations().then(result => {
      if (!active) return;
      const organizations = Array.isArray(result?.data) ? result.data : [];
      setCompanies(organizations.filter(company =>
        ["OWNER", "ADMIN"].includes(company.role) && company.status === "ACTIVE"));
    }).catch(() => {
      if (active) setError("Nie można pobrać listy spółek. Odśwież stronę.");
    });
    return () => { active = false; };
  }, []);
  return <section aria-label="Wybór przestrzeni dokumentów"
    className="mt-5 rounded-2xl border border-violet-400/20 bg-[#101b34] p-4">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h2 className="font-bold">Gdzie mają być zapisane dokumenty?</h2>
      <span className="flex items-center gap-1.5 text-xs text-slate-400"><ShieldCheck size={14}/> Oddzielne dane i uprawnienia</span>
    </div>
    <nav aria-label="Przestrzenie dokumentów" className="mt-3 flex flex-wrap gap-2">
      <Link href="/document" aria-current={!activeOrganizationId ? "page" : undefined}
        className={"inline-flex min-h-11 items-center gap-2 rounded-xl border px-4 text-sm font-semibold " +
          (!activeOrganizationId ? "border-violet-300 bg-violet-600 text-white" : "border-white/15 bg-white/5 text-slate-200 hover:bg-white/10")}>
        <FolderOpen size={17}/> Dokumenty osobiste
      </Link>
      {companies.map(company => <Link key={company.id}
        href={"/company/" + encodeURIComponent(company.id) + "/documents"}
        aria-current={activeOrganizationId === company.id ? "page" : undefined}
        className={"inline-flex min-h-11 items-center gap-2 rounded-xl border px-4 text-sm font-semibold " +
          (activeOrganizationId === company.id ? "border-violet-300 bg-violet-600 text-white" : "border-white/15 bg-white/5 text-slate-200 hover:bg-white/10")}>
        <Building2 size={17}/> {company.displayName || company.name}
      </Link>)}
    </nav>
    {error && <p role="status" className="mt-2 text-xs text-amber-200">{error}</p>}
    <p className="mt-3 text-xs leading-5 text-slate-400">
      Pliki przesłane do jednej spółki nie pojawiają się w drugiej spółce ani w dokumentach osobistych.
    </p>
  </section>;
}
