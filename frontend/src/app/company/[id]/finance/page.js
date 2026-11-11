"use client";
import {useEffect,useMemo,useState} from "react";
import Link from "next/link";
import {useParams} from "next/navigation";
import {ArrowLeft,Wallet,RefreshCw,Link2,ShieldCheck,FileText,
  AlertTriangle,ChevronLeft,ChevronRight,Users,FolderKanban} from "lucide-react";
import Navbar from "../../../components/Navbar";
import UserMenu from "../../../components/UserMenu";
import {
 getOrganizationFinanceStatus,linkOrganizationKsef,getOrganizationFinanceSummary,
 getOrganizationWorkspace,
 getOrganizationFinanceDocuments,getOrganizationFinanceProjects,
 getOrganizationFinanceMembers,changeOrganizationFinancePermission
} from "@/lib/api";
const AMOUNT=(value,currency)=> {
 const n=Number(value);
 if(!Number.isFinite(n))return "—";
 try{return new Intl.NumberFormat("pl-PL",{style:"currency",currency:currency||"PLN"}).format(n);}
 catch{return String(value)+" "+currency;}
};
const DATE=value=>value?new Date(value).toLocaleDateString("pl-PL"):"—";
const SOURCE={INCOMING:"Zakup",OUTGOING:"Sprzedaż"};
const PAGE_SIZE=50;
export default function CompanyFinancePage(){
 const {id}=useParams();
 const [status,setStatus]=useState(null);
 const [companyName,setCompanyName]=useState("");
 const [summary,setSummary]=useState(null);
 const [documents,setDocuments]=useState([]);
 const [projects,setProjects]=useState([]);
 const [members,setMembers]=useState([]);
 const [hasMore,setHasMore]=useState(false);
 const [page,setPage]=useState(0);
 const [loading,setLoading]=useState(true);
 const [busy,setBusy]=useState(false);
 const [notice,setNotice]=useState("");
 const [error,setError]=useState("");
 const [refresh,setRefresh]=useState(0);
 useEffect(()=>{
  if(!id)return;
  let active=true;setLoading(true);setError("");
  Promise.all([getOrganizationFinanceStatus(id),getOrganizationWorkspace(id)]).then(async ([result,workspace])=>{
   if(active)setCompanyName(workspace?.data?.company?.displayName||workspace?.data?.company?.name||"");
   if(!active)return;
   const value=result?.data||{};
   setStatus(value);
   if(!value.linked||!value.canView){
    setSummary(null);setDocuments([]);setProjects([]);setMembers([]);
    return;
   }
   const queries=[
    getOrganizationFinanceSummary(id),
    getOrganizationFinanceDocuments(id,{offset:page*PAGE_SIZE,limit:PAGE_SIZE}),
    getOrganizationFinanceProjects(id),
    value.canManage?getOrganizationFinanceMembers(id):Promise.resolve({data:[]})
   ];
   const results=await Promise.all(queries);
   if(!active)return;
   setSummary(results[0]?.data||null);
   setDocuments(Array.isArray(results[1]?.data?.items)?results[1].data.items:[]);
   setHasMore(Boolean(results[1]?.data?.hasMore));
   setProjects(Array.isArray(results[2]?.data?.items)?results[2].data.items:[]);
   setMembers(Array.isArray(results[3]?.data)?results[3].data:[]);
  }).catch(e=>{if(active){setError(e.message||"Nie udało się pobrać finansów.");setSummary(null);}})
   .finally(()=>{if(active)setLoading(false);});
  return()=>{active=false;};
 },[id,refresh,page]);
 async function doAction(fn,success){
  if(busy)return;setBusy(true);setError("");setNotice("");
  try{await fn();setNotice(success);setRefresh(v=>v+1);}
  catch(e){setError(e.message||"Operacja nie powiodła się.");}
  finally{setBusy(false);}
 }
 const amounts=summary?.amounts||[];
 const currencies=[...new Set(amounts.map(x=>x.currency))];
 const group=useMemo(()=>({purchases:documents.filter(x=>x.direction==="INCOMING").length,
   sales:documents.filter(x=>x.direction==="OUTGOING").length}),[documents]);
 return <main className="min-h-screen min-w-0 overflow-x-clip bg-[#080e20] px-3 py-5 text-slate-100 sm:px-6 lg:px-8">
  <div className="mx-auto w-full max-w-7xl min-w-0">
   <header className="flex min-w-0 flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-[#111c35] p-4">
    <Link href={"/company/"+encodeURIComponent(id)} className="inline-flex items-center gap-2 text-sm font-bold text-violet-200"><ArrowLeft size={17}/> Panel firmy</Link>
    <UserMenu/>
   </header>
   <Navbar/>
   <div className="mt-6 flex flex-wrap items-start justify-between gap-3">
    <div className="min-w-0">
     <p className="text-xs font-bold uppercase tracking-widest text-violet-300">Przestrzeń firmowa / KSeF</p>
     <h1 className="mt-2 break-words text-3xl font-black sm:text-4xl">Finanse {companyName||"firmy"}</h1>
     <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
      Firmowe zestawienie faktur KSeF i inwestycji, bez przenoszenia prywatnej historii konta właściciela.
      Dane pochodzą z istniejącej integracji, a pracownicy otrzymują dostęp wyłącznie po jego nadaniu.
     </p>
    </div>
    <button type="button" disabled={loading||busy} onClick={()=>setRefresh(x=>x+1)}
     className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/15 px-4 text-sm disabled:opacity-50">
     <RefreshCw size={16} className={loading?"animate-spin":""}/> Odśwież
    </button>
   </div>
   <div className="mt-5 flex min-w-0 items-start gap-3 rounded-2xl border border-amber-300/20 bg-amber-400/[.06] p-4 text-xs leading-6 text-amber-100">
    <AlertTriangle size={18} className="mt-0.5 shrink-0"/>
    <span>Kwoty na tej stronie są wartościami faktur, a nie potwierdzonymi wpływami lub wypływami bankowymi.
    Dane są wybierane po NIP spółki, dlatego dokumenty z niepełnym NIP mogą wymagać uzupełnienia w KSeF.</span>
   </div>
   {loading&&<p className="mt-5 text-sm text-slate-400">Ładowanie danych firmowych…</p>}
   {error&&<p role="alert" className="mt-5 rounded-xl border border-rose-400/20 bg-rose-400/10 p-4 text-sm text-rose-200">{error}</p>}
   {notice&&<p role="status" className="mt-5 rounded-xl border border-emerald-400/20 bg-emerald-400/10 p-4 text-sm text-emerald-200">{notice}</p>}
   {!loading&&status&&!status.linked&&<section className="mt-6 max-w-3xl rounded-3xl border border-white/10 bg-[#111c35] p-5 sm:p-7">
    <h2 className="flex items-center gap-2 text-xl font-bold"><Link2 size={20} className="text-violet-300"/> {status.canLink?`Połącz KSeF ${companyName||"firmy"}`:"Konfiguracja KSeF dla tej firmy"}</h2>
    <p className="mt-3 text-sm leading-6 text-slate-300">
     {status.canLink?"Połączenie wyświetli faktury już pobrane na koncie właściciela. Nie skopiuje danych ani nie nada dostępu pracownikom.":"Ta firma nie ma jeszcze własnej autoryzowanej integracji KSeF. Nie można użyć tokenu i NIP innej spółki. Potrzebna jest oddzielna konfiguracja uprawnień i synchronizacji KSeF dla tej firmy."}
    </p>
    {status.canLink?<button type="button" disabled={busy} onClick={()=>doAction(
      ()=>linkOrganizationKsef(id),`KSeF ${companyName||"firmy"} połączony z tą przestrzenią.`)}
      className="mt-5 min-h-12 w-full rounded-xl bg-violet-500 px-5 font-bold text-white hover:bg-violet-400 disabled:opacity-50 sm:w-auto">
      {busy?"Łączę…":`Połącz KSeF ${companyName||"firmy"}`}
    </button>:<p className="mt-4 rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-slate-400">
     Automatyczne podłączenie wymaga osobnej, aktywnej konfiguracji KSeF dla wybranej firmy.
    </p>}
   </section>}
   {!loading&&status?.linked&&!status.canView&&<section className="mt-6 max-w-3xl rounded-3xl border border-white/10 bg-[#111c35] p-6">
     <h2 className="flex items-center gap-2 text-xl font-bold"><ShieldCheck className="text-violet-300"/> Finanse dostępne na zaproszenie</h2>
     <p className="mt-3 text-sm leading-6 text-slate-300">Należysz do tej firmy, ale nie masz jeszcze osobnego uprawnienia finansowego. Właściciel integracji może je włączyć w tej przestrzeni.</p>
   </section>}
   {!loading&&summary&&<>
    <section className="mt-6 grid gap-3 sm:grid-cols-3">
     <div className="min-w-0 rounded-2xl border border-white/10 bg-[#111c35] p-5">
      <FileText size={22} className="text-violet-300"/>
      <p className="mt-4 text-3xl font-black">{summary.count??0}</p>
      <p className="mt-1 text-xs text-slate-400">Faktury KSeF powiązane z NIP</p>
     </div>
     <div className="min-w-0 rounded-2xl border border-white/10 bg-[#111c35] p-5">
      <Wallet size={22} className="text-violet-300"/>
      <p className="mt-4 text-xl font-black">{summary.sync?.enabled?"Włączony":"Wyłączony"}</p>
      <p className="mt-1 text-xs text-slate-400">Financial Agent właściciela · status: {summary.sync?.status||"—"}</p>
     </div>
     <div className="min-w-0 rounded-2xl border border-white/10 bg-[#111c35] p-5">
      <RefreshCw size={22} className="text-violet-300"/>
      <p className="mt-4 text-xl font-black">{DATE(summary.sync?.lastRunAt)}</p>
      <p className="mt-1 text-xs text-slate-400">Ostatnie uruchomienie Financial Agent</p>
     </div>
    </section>
    <section className="mt-5 min-w-0 rounded-3xl border border-white/10 bg-[#111c35] p-4 sm:p-6">
     <h2 className="text-xl font-bold">Wartość faktur według kierunku</h2>
     <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {amounts.map((a,i)=><div key={a.currency+"-"+a.direction+"-"+i}
       className="min-w-0 rounded-xl border border-white/10 bg-[#182742] p-4">
       <p className="text-xs text-slate-400">{SOURCE[a.direction]||"Inny kierunek"} · {a.currency}</p>
       <p className="mt-2 break-words text-lg font-bold tabular-nums">{AMOUNT(a.gross,a.currency)}</p>
       <p className="mt-1 text-xs text-slate-400">{a.count} dokumentów · brutto</p>
      </div>)}
      {amounts.length===0&&<p className="text-sm text-slate-400">Brak faktur z NIP tej spółki.</p>}
     </div>
     {currencies.length>1&&<p className="mt-4 text-xs text-slate-400">Waluty są rozdzielone; system nie sumuje PLN i EUR bez kursów.</p>}
    </section>
    <section className="mt-5 min-w-0 overflow-hidden rounded-3xl border border-white/10 bg-[#111c35] p-4 sm:p-6">
     <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 className="text-xl font-bold">Faktury firmy</h2>
      <span className="text-xs text-slate-400">Strona {page+1} · do {PAGE_SIZE} dokumentów</span>
     </div>
     <div className="mt-4 max-w-full overflow-x-auto">
      <table className="min-w-[730px] w-full text-left text-xs sm:text-sm">
       <thead className="border-b border-white/15 text-slate-400">
        <tr><th className="px-3 py-3">Data</th><th className="px-3 py-3">Numer</th>
         <th className="px-3 py-3">Kontrahent</th><th className="px-3 py-3">Rodzaj</th>
         <th className="px-3 py-3">Inwestycja</th><th className="px-3 py-3 text-right">Brutto</th></tr>
       </thead>
       <tbody>{documents.map(d=><tr key={d.id} className="border-b border-white/[.06]">
        <td className="px-3 py-3 text-slate-300">{DATE(d.issueDate)}</td>
        <td className="max-w-32 break-words px-3 py-3">{d.invoiceNumber||"—"}</td>
        <td className="max-w-52 break-words px-3 py-3 text-slate-300">{d.direction==="OUTGOING"?d.buyerName||"—":d.sellerName||"—"}</td>
        <td className="px-3 py-3">{SOURCE[d.direction]||"—"}</td>
        <td className="max-w-40 break-words px-3 py-3 text-slate-300">{d.project?.name||"Nieprzypisana"}</td>
        <td className="whitespace-nowrap px-3 py-3 text-right font-bold tabular-nums">{AMOUNT(d.grossAmount,d.currency)}</td>
       </tr>)}</tbody>
      </table>
      {documents.length===0&&<p className="py-8 text-center text-sm text-slate-400">Nie znaleziono faktur.</p>}
     </div>
     <div className="mt-4 flex items-center justify-end gap-2">
      <button type="button" disabled={loading||page===0} onClick={()=>setPage(n=>Math.max(0,n-1))}
       className="inline-flex min-h-11 items-center gap-1 rounded-xl border border-white/20 px-4 text-sm disabled:opacity-40"><ChevronLeft size={16}/> Wstecz</button>
      <button type="button" disabled={loading||!hasMore} onClick={()=>setPage(n=>n+1)}
       className="inline-flex min-h-11 items-center gap-1 rounded-xl border border-white/20 px-4 text-sm disabled:opacity-40">Dalej <ChevronRight size={16}/></button>
     </div>
    </section>
    <section className="mt-5 rounded-3xl border border-white/10 bg-[#111c35] p-4 sm:p-6">
     <h2 className="flex items-center gap-2 text-xl font-bold"><FolderKanban size={21} className="text-violet-300"/> Inwestycje {companyName||"firmy"}</h2>
     <p className="mt-1 text-xs text-slate-400">Projekty powiązane z tą firmą na koncie właściciela</p>
     <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {projects.map(project=><div key={project.id} className="min-w-0 rounded-xl border border-white/10 bg-[#182742] p-4">
       <strong className="block break-words text-sm">{project.name}</strong>
       <p className="mt-2 break-words text-xs text-slate-400">{project.company}</p>
      </div>)}
      {projects.length===0&&<p className="text-sm text-slate-400">Brak inwestycji przypisanych do tej firmy.</p>}
     </div>
    </section>
    {status?.canManage&&<section id="finance-permissions" className="mt-5 min-w-0 scroll-mt-24 rounded-3xl border border-violet-400/25 bg-[#111c35] p-4 sm:p-6">
     <h2 className="flex items-center gap-2 text-xl font-bold"><Users size={21} className="text-violet-300"/> Dostęp pracowników do finansów</h2>
     <p className="mt-2 text-sm leading-6 text-slate-300">Uprawnienie nadajesz osobno, niezależnie od roli firmowej. Pracownik otrzyma wyłącznie odczyt firmowych faktur z właściwym NIP, a nie token KSeF czy prawo do importu.</p>
     <div className="mt-4 space-y-2">
      {members.map(m=><div key={m.id} className="flex min-w-0 flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-[#182742] p-4">
       <div className="min-w-0"><strong className="block break-all text-sm">{m.email}</strong>
        <span className="mt-1 block text-xs text-slate-400">{m.role} · {m.isFinancialOwner?"Właściciel integracji":m.financeAccess?"Ma dostęp":"Bez dostępu finansowego"}</span></div>
       {!m.isFinancialOwner&&m.role!=="OWNER"&&<button type="button" disabled={busy}
        onClick={()=>doAction(()=>changeOrganizationFinancePermission(id,m.id,!m.financeAccess),
         m.financeAccess?"Odebrano dostęp do finansów.":"Przyznano dostęp tylko do odczytu finansów tej firmy.")}
        className={"min-h-11 rounded-xl border px-4 text-xs font-bold disabled:opacity-40 "+(m.financeAccess
        ?"border-rose-400/30 bg-rose-400/10 text-rose-200"
        :"border-violet-400/40 bg-violet-500/20 text-violet-200")}>
        {m.financeAccess?"Odbierz dostęp":"Nadaj dostęp"}
       </button>}
      </div>)}
      {members.length<=1&&<p className="text-sm text-slate-400">Brak innych aktywnych pracowników. Zaproś ich w zakładce Zespół.</p>}
     </div>
    </section>}
   </>}
   <footer className="mt-8 border-t border-white/10 pt-5 text-xs leading-6 text-slate-400">
    PrzemAI · Dane KSeF i konto właściciela pozostają osobne od przestrzeni pracowników.
    Zestawienie nie zastępuje księgowości ani informacji o płatnościach bankowych.
   </footer>
  </div>
 </main>;
}
