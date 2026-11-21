"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Building2, FileText, ShieldCheck } from "lucide-react";
import Navbar from "../../../components/Navbar";
import UserMenu from "../../../components/UserMenu";
import DocumentScopeSwitcher from "../../../components/DocumentScopeSwitcher";
import CompanyDocuments from "../CompanyDocuments";
import { getOrganization } from "@/lib/api";

export default function CompanyDocumentPage() {
  const { id } = useParams();
  const [company, setCompany] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!id) return;
    let active = true;
    setLoading(true); setCompany(null); setError("");
    getOrganization(id).then(result => {
      if (!active) return;
      if (!result?.data?.id || result.data.id !== id)
        throw new Error("Nie można potwierdzić przestrzeni spółki.");
      setCompany(result.data);
    }).catch(err => {
      if (active) setError(err?.message || "Nie udało się wczytać spółki.");
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id]);

  const allowed = company && ["OWNER", "ADMIN"].includes(company.role);
  return <main className="min-h-screen min-w-0 overflow-x-clip bg-[#080e20] px-3 py-5 pb-28 text-slate-100 sm:px-6 lg:px-8">
    <div className="mx-auto w-full max-w-7xl">
      <header className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-[#111c35] p-4">
        <Link href={"/company/" + encodeURIComponent(id)} className="inline-flex items-center gap-2 text-sm font-semibold text-violet-200">
          <ArrowLeft size={18}/> Wróć do spółki
        </Link>
        <UserMenu/>
      </header>
      <Navbar/>
      <div className="rounded-2xl border border-violet-400/25 bg-gradient-to-r from-[#241847] to-[#103657] p-5 sm:p-7">
        <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-violet-200"><FileText size={16}/> Dokumenty firmowe</p>
        <h1 className="mt-3 break-words text-2xl font-black sm:text-4xl">
          {company ? "Dokumenty — " + (company.displayName || company.name) : "Dokumenty spółki"}
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-200">Każdy dodany tutaj plik zostaje przypisany wyłącznie do wskazanej spółki.</p>
      </div>
      <DocumentScopeSwitcher activeOrganizationId={id}/>
      {loading && <p role="status" className="mt-5 text-sm text-slate-300">Sprawdzam uprawnienia do spółki…</p>}
      {error && <p role="alert" className="mt-5 rounded-xl border border-rose-400/30 bg-rose-400/10 p-4 text-sm text-rose-200">{error}</p>}
      {!loading && company && !allowed && <p role="alert" className="mt-5 rounded-xl border border-amber-400/30 bg-amber-400/10 p-4 text-sm text-amber-200">
        Dokumenty spółki są dostępne dla jej właściciela i administratorów.
      </p>}
      {allowed && <CompanyDocuments organizationId={id} organizationName={company.displayName || company.name}/>}
      <p className="mt-6 flex items-center gap-2 text-xs text-slate-400"><ShieldCheck size={15}/> Dane spółek pozostają odseparowane także po stronie API.</p>
    </div>
  </main>;
}
