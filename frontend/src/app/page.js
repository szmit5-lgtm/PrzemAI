"use client";

import {useEffect,useMemo,useState} from "react";
import Link from "next/link";
import {Activity,ArrowUpRight,BarChart3,Bot,BriefcaseBusiness,
 Building2,CalendarDays,CheckCircle2,ChevronRight,Clock3,FileText,
 FolderKanban,Handshake,Landmark,MessageSquareText,Mic,Plus,
 RefreshCw,ShieldCheck,Wallet,Workflow,AlertCircle,Mail,TrendingUp,Calculator,ShoppingCart,MessageCircle,Search} from "lucide-react";
import Navbar from "./components/Navbar";
import UserMenu from "./components/UserMenu";
import {
 getAgents,getExecutiveDashboard,getFinanceSummary,getFinanceProjects,
 getOrganizations,getOrganizationFinanceSummary,getOrganizationFinanceAnnualReport,getFinancePeriodReport
} from "@/lib/api";

const months=["Sty","Lut","Mar","Kwi","Maj","Cze","Lip","Sie","Wrz","Paź","Lis","Gru"];
const money=(value,currency="PLN")=>{
 if(value==null||value==="")return "—";
 const n=Number(value);
 return Number.isFinite(n)?new Intl.NumberFormat("pl-PL",
  {style:"currency",currency,maximumFractionDigits:0}).format(n):"—";
};
const readValue=(result,key)=>result.status==="fulfilled"?result.value?.[key]:null;
const agentVisuals=[
 [/financ|finans|ksef/i,Wallet,"bg-emerald-500/15 text-emerald-300"],
 [/mail|poczt/i,Mail,"bg-blue-500/15 text-blue-300"],
 [/document|dokument/i,FileText,"bg-teal-500/15 text-teal-300"],
 [/meeting|spotka/i,CalendarDays,"bg-violet-500/15 text-violet-300"],
 [/sales|sprzeda/i,ShoppingCart,"bg-amber-500/15 text-amber-300"],
 [/whatsapp/i,MessageCircle,"bg-green-500/15 text-green-300"],
 [/invest|trading|mt5|inwest/i,TrendingUp,"bg-cyan-500/15 text-cyan-300"],
 [/account|księg/i,Calculator,"bg-slate-500/15 text-slate-300"]
];
function AgentTile({agent:a}){
 const [,Icon,color]=agentVisuals.find(([pattern])=>pattern.test(String(a.key||"")+" "+String(a.name||"")))||[null,Bot,"bg-violet-500/15 text-violet-300"];
 return <Link href={a.key==="financial"?"/finance":"/agents/"+a.key} className="flex min-w-0 flex-col items-center gap-2 rounded-xl border border-white/10 bg-gradient-to-br from-[#192b43] to-[#10192e] p-3 text-center hover:border-violet-400/60">
  <span className={"rounded-xl p-2 "+color}><Icon size={23}/></span><strong className="w-full break-words text-xs">{a.name}</strong>
  <span className={"inline-flex items-center gap-1 text-[11px] "+(a.status==="RUNNING"?"text-amber-300":a.enabled?"text-emerald-300":"text-slate-400")}><i className={"h-2 w-2 rounded-full "+(a.status==="RUNNING"?"bg-amber-400":a.enabled?"bg-emerald-400":"bg-slate-500")}/>{a.status==="RUNNING"?"Pracuje":a.enabled?"Włączony":"Wyłączony"}</span>
 </Link>;
}
function CalendarPanel(){
 const [offset,setOffset]=useState(0);
 const today=new Date(),date=new Date(today.getFullYear(),today.getMonth()+offset,1),year=date.getFullYear(),month=date.getMonth();
 const start=(date.getDay()+6)%7,days=new Date(year,month+1,0).getDate();
 return <Panel className="p-3"><SectionTitle href="/meeting" link="Spotkania">Kalendarz</SectionTitle><div className="mt-3 flex items-center justify-between gap-1 text-xs"><strong className="capitalize">{date.toLocaleDateString("pl-PL",{month:"long",year:"numeric"})}</strong><div className="flex gap-1"><button type="button" aria-label="Poprzedni miesiąc" onClick={()=>setOffset(v=>v-1)} className="min-h-9 min-w-9 rounded-lg bg-white/5">‹</button><button type="button" aria-label="Następny miesiąc" onClick={()=>setOffset(v=>v+1)} className="min-h-9 min-w-9 rounded-lg bg-white/5">›</button></div></div><div className="mt-2 grid grid-cols-7 gap-1 text-center text-[11px]">{["Pn","Wt","Śr","Cz","Pt","So","Nd"].map(d=><span key={d} className="text-slate-400">{d}</span>)}{Array.from({length:start+days},(_,i)=>{const d=i-start+1;const current=offset===0&&d===today.getDate();return <span key={i} aria-current={current?"date":undefined} className={"flex aspect-square items-center justify-center rounded-full "+(current?"bg-violet-600 font-bold text-white":"text-slate-300")}>{d>0?d:""}</span>})}</div></Panel>;
}
function Panel({children,className=""}) {
 return <section className={"min-w-0 overflow-hidden rounded-2xl border border-white/10 bg-[#101a30] shadow-[0_12px_35px_rgba(0,0,0,.16)] "+className}>{children}</section>;
}
function SectionTitle({children,href,link="Pokaż wszystkie"}) {
 return <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
  <h2 className="break-words text-base font-bold sm:text-lg">{children}</h2>
  {href&&<Link href={href} className="inline-flex items-center gap-1 text-xs font-semibold text-violet-300 hover:text-violet-200">{link}<ArrowUpRight size={13}/></Link>}
 </div>;
}
function Metric({label,value,icon:Icon,foot,accent="blue"}) {
 const theme={
  blue:"bg-blue-500/20 text-blue-200",green:"bg-emerald-500/20 text-emerald-200",
  purple:"bg-violet-500/20 text-violet-200",orange:"bg-amber-500/20 text-amber-200"
 }[accent];
 return <Panel className={"p-3 "+({blue:"border-blue-400/30 bg-gradient-to-br from-blue-950 to-[#101b31]",green:"border-emerald-400/30 bg-gradient-to-br from-emerald-950 to-[#101b31]",purple:"border-violet-400/30 bg-gradient-to-br from-violet-950 to-[#101b31]",orange:"border-amber-400/30 bg-gradient-to-br from-amber-950/80 to-[#101b31]"}[accent])}>
  <div className="flex min-w-0 items-center gap-3">
   <span className={"shrink-0 rounded-xl p-2.5 "+theme}><Icon size={23}/></span>
   <div className="min-w-0"><p className="text-xs font-medium text-slate-200">{label}</p><p className="mt-1 break-words text-xl font-extrabold tracking-tight tabular-nums text-white xl:text-2xl">{value}</p></div>
  </div>
  <p className="mt-2 text-[11px] leading-4 text-slate-300">{foot}<span className="ml-1 text-[10px] text-slate-400">· DANE Z SYSTEMU</span></p>
 </Panel>;
}
function SmallLink({href,title,icon:Icon}) {
 return <Link href={href} className="flex min-h-12 min-w-0 items-center gap-2 rounded-xl border border-white/10 bg-[#1b2745] px-3 text-xs font-semibold text-slate-200 hover:border-violet-400/40 hover:bg-[#26375d]">
  <Icon size={17} className="shrink-0 text-violet-300"/>
  <span className="min-w-0 break-words">{title}</span>
  <ChevronRight size={14} className="ml-auto shrink-0 text-slate-500"/>
 </Link>;
}
export default function HomePage() {
 const [data,setData]=useState(null);
 const [loading,setLoading]=useState(true);
 const [errors,setErrors]=useState(0);
 const [refresh,setRefresh]=useState(0);
 const [companySearch,setCompanySearch]=useState("");
 const [simpleMode,setSimpleMode]=useState(false);
 const [primaryCompany,setPrimaryCompany]=useState("");
 const [companyFinanceState,setCompanyFinance]=useState(null);
 const [companyFinanceError,setCompanyFinanceError]=useState("");
 const [companyReportState,setCompanyReport]=useState(null);
 useEffect(()=>{try{setPrimaryCompany(window.localStorage.getItem("przemai-primary-organization")||"");}catch{}},[]);
 useEffect(()=>{try{setSimpleMode(window.localStorage.getItem("przemai-dashboard-mode")==="simple");}catch{}},[]);
 const switchMode=mode=>{setSimpleMode(mode);try{window.localStorage.setItem("przemai-dashboard-mode",mode?"simple":"full");}catch{}};
 useEffect(()=>{
  let alive=true;
  setLoading(true);
  Promise.allSettled([
   getExecutiveDashboard(),getAgents(),getFinanceSummary(),
   getFinanceProjects(),getOrganizations(),getFinancePeriodReport(new Date().getFullYear())
  ]).then(results=>{
   if(!alive)return;
   setErrors(results.filter(r=>r.status==="rejected").length);
   setData({
    executive:readValue(results[0],"dashboard"),
    agents:readValue(results[1],"data")||[],
    finance:readValue(results[2],"data"),
    projects:readValue(results[3],"items")||[],
    organizations:readValue(results[4],"data")||[],
    report:readValue(results[5],"data")
   });
  }).finally(()=>{if(alive)setLoading(false);});
  return()=>{alive=false;};
 },[refresh]);
 useEffect(()=>{
  const allowed=(data?.organizations||[]).some(o=>o.id===primaryCompany);
  if(!allowed){setCompanyFinance(null);setCompanyReport(null);setCompanyFinanceError("");return;}
  let active=true;setCompanyFinance(null);setCompanyReport(null);setCompanyFinanceError("");
  getOrganizationFinanceAnnualReport(primaryCompany,new Date().getFullYear()).then(result=>{if(active)setCompanyReport({organizationId:primaryCompany,data:result?.data||null});}).catch(()=>{if(active)setCompanyReport(null);});
  getOrganizationFinanceSummary(primaryCompany).then(result=>{
   if(active)setCompanyFinance({organizationId:primaryCompany,data:result?.data||null});
  }).catch(error=>{if(active)setCompanyFinanceError(error?.message||"Nie można pobrać KSeF.");});
  return()=>{active=false;};
 },[primaryCompany,data?.organizations]);
 const selectPrimaryCompany=id=>{
  setPrimaryCompany(id);
  try{if(id)window.localStorage.setItem("przemai-primary-organization",id);
   else window.localStorage.removeItem("przemai-primary-organization");}catch{}
 };
 const agents=Array.isArray(data?.agents)?data.agents:[];
 const personalProjects=Array.isArray(data?.projects)?data.projects:[];
 const selectedOrg=(data?.organizations||[]).find(o=>o.id===primaryCompany);
 const companyFinance=selectedOrg&&companyFinanceState?.organizationId===primaryCompany?companyFinanceState.data:null;
 const companyReport=selectedOrg&&companyReportState?.organizationId===primaryCompany?companyReportState.data:null;
 const projects=primaryCompany&&!selectedOrg?[]:selectedOrg?personalProjects.filter(p=>{
  const label=String(p.company||"").toLocaleLowerCase("pl-PL");
  const orgName=String(selectedOrg.name||"").toLocaleLowerCase("pl-PL");
  return label===orgName || (/(deherus|m1)/.test(orgName)&&/(deherus|^m1$)/.test(label));
 }):personalProjects;
 const organizations=Array.isArray(data?.organizations)?data.organizations:[];
 const summary=data?.executive?.summary||{};
 const finance=data?.finance||{};
 const amounts=Array.isArray(finance.amounts)?finance.amounts:[];
 // Different currencies must never be added to PLN.
 const purchasePLN=amounts.find(a=>a.currency==="PLN"&&a.direction==="INCOMING");
 const salesPLN=amounts.find(a=>a.currency==="PLN"&&a.direction==="OUTGOING");
 const enabled=agents.filter(a=>a.enabled).length;
 const reportRows=primaryCompany?(selectedOrg?(companyReport?.rows||[]):[]):(Array.isArray(data?.report?.rows)?data.report.rows:[]);
 const chart=useMemo(()=>months.map((label,index)=>{
   const rows=reportRows.filter(r=>r.currency==="PLN"&&(primaryCompany?r.month===index+1:r.period==="MONTH"&&r.number===index+1));
   const total=group=>rows.filter(r=>primaryCompany?r.direction===group:r.group===group).reduce((s,r)=>s+Number(r.gross||0),0);
   return {label,sales:total(primaryCompany?"OUTGOING":"INVOICED_SALES"),purchase:total(primaryCompany?"INCOMING":"INVOICED_PURCHASES")};
 }),[reportRows,primaryCompany]);
 const chartMax=Math.max(1,...chart.flatMap(r=>[r.sales,r.purchase]));
 const nowMonth=new Date().getMonth();
 const shownMonths=chart.slice(0,Math.max(3,nowMonth+1));
 const filteredCompanies=organizations.filter(o=>
  (o.displayName||o.name||"").toLocaleLowerCase("pl-PL").includes(companySearch.toLocaleLowerCase("pl-PL")));
 const ready=data!==null;
 return <main className="min-h-screen min-w-0 bg-[#080e20] text-slate-100">
  <div className="mx-auto grid min-h-screen max-w-[2200px] min-w-0 lg:grid-cols-[205px_minmax(0,1fr)]">
   <aside className="hidden min-w-0 border-r border-violet-300/10 bg-gradient-to-b from-[#11152e] to-[#080e20] px-3 py-5 lg:flex lg:flex-col">
    <Link href="/" className="flex items-center gap-3 px-3 py-2 text-xl font-black tracking-tight">
     <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-fuchsia-500 to-violet-700"><svg viewBox="0 0 40 40" width="34" height="34" aria-hidden="true"><path d="M9 9h16a10 10 0 0 1 0 20h-8v7H9V21h16a3 3 0 0 0 0-6H9Z" fill="white"/><path d="M9 9l8 6v6H9Z" fill="#c4b5fd"/></svg></span>
     <span>Przem<span className="text-violet-300">AI</span><span className="ml-1 text-sm text-violet-400">2.0</span><span className="block text-[10px] font-medium text-slate-400">Asystent biznesowy AI</span></span>
    </Link>
    <div className="mt-4 border-t border-white/10 pt-5">
     <Navbar vertical organizationId={["OWNER","ADMIN"].includes(selectedOrg?.role) ? selectedOrg.id : null}/>
    </div>
    <div className="mt-5 border-t border-white/10 pt-5">
     <p className="px-3 text-[11px] font-bold uppercase tracking-widest text-slate-500">Przestrzenie firm</p>
     <div className="mt-3 space-y-1">
      {organizations.slice(0,6).map(o=><Link href={"/company/"+encodeURIComponent(o.id)} key={o.id}
        className="flex min-w-0 items-center gap-2 rounded-lg px-3 py-2 text-xs text-slate-300 hover:bg-white/10">
        <Building2 size={15} className="shrink-0 text-violet-300"/>
        <span className="min-w-0 truncate">{o.displayName||o.name}</span>
      </Link>)}
      {organizations.length===0&&<p className="px-3 text-xs leading-5 text-slate-500">Nie dodano jeszcze przestrzeni firmowej.</p>}
      <Link href="/company/setup" className="flex items-center gap-2 px-3 py-2 text-xs font-semibold text-violet-300"><Plus size={15}/> Zarządzaj spółkami</Link>
     </div>
    </div>
    <div className="mt-auto rounded-2xl border border-violet-400/20 bg-[#1a2545] p-4">
     <div className="flex items-center gap-2 text-sm font-bold"><ShieldCheck size={17} className="text-emerald-300"/> PrzemAI</div>
     <p className="mt-2 text-xs leading-5 text-slate-300">Dane i uprawnienia są przypisane do konta. Bank wymaga osobnej integracji.</p>
    </div>
   </aside>
   <div className="min-w-0 px-3 pb-9 pt-4 sm:px-6 lg:px-7 2xl:px-5">
    <header className="flex min-w-0 flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-[#111c35] px-4 py-3 sm:px-5">
     <div className="flex min-w-0 items-center gap-3">
      <span className="rounded-xl bg-violet-500/15 p-2 text-violet-300 lg:hidden"><Bot size={21}/></span>
      <div className="min-w-0">
       <p className="truncate text-sm font-bold sm:text-base">PrzemAI <span className="ml-2 font-normal text-slate-400">Panel operacyjny</span></p>
       <p className="truncate text-[11px] text-slate-500">Agenci · Finanse · Inwestycje</p>
      </div>
     </div>
     <div className="flex flex-wrap items-center gap-3">
      <div role="group" aria-label="Tryb pulpitu" className="flex rounded-xl border border-white/15 p-1 text-xs">
       <button type="button" aria-pressed={simpleMode} onClick={()=>switchMode(true)} className={"rounded-lg px-3 py-2 "+(simpleMode?"bg-violet-600 text-white":"text-slate-300")}>Uproszczony</button>
       <button type="button" aria-pressed={!simpleMode} onClick={()=>switchMode(false)} className={"rounded-lg px-3 py-2 "+(!simpleMode?"bg-violet-600 text-white":"text-slate-300")}>Pełny</button>
      </div>
      <UserMenu/>
     </div>
    </header>
    <div className="lg:hidden"><Navbar organizationId={["OWNER","ADMIN"].includes(selectedOrg?.role) ? selectedOrg.id : null}/></div>
    <div className="relative mt-3 flex min-w-0 flex-wrap items-center justify-between gap-3 overflow-hidden rounded-2xl border border-violet-400/20 bg-gradient-to-r from-[#17132e] via-[#132947] to-[#173e60] p-3 sm:p-4" aria-busy={loading}>
     <svg aria-hidden="true" viewBox="0 0 420 100" className="pointer-events-none absolute right-0 bottom-0 hidden h-full w-[45%] opacity-35 md:block" fill="none" stroke="#a5b4fc" strokeWidth="1.3"><path d="M0 95h420M30 95V56h48v39M90 95V34h60v61M167 95V48h38v47M214 95V18h66v77M298 95V40h47v55M358 95V7h60v88M105 34v-15h25v15M230 18V4h35v14M195 95V12h-74M195 12l-22 9M140 12v30M320 40V4h-75M320 4l-20 8M260 4v27"/><path d="M38 66h32M38 76h32M100 46h40M100 58h40M100 70h40M224 30h46M224 42h46M224 54h46M224 66h46M224 78h46M367 20h42M367 32h42M367 44h42M367 56h42M367 68h42M367 80h42"/></svg>
     <div className="relative min-w-0 flex-1">
      <p className="text-xs font-bold uppercase tracking-[.17em] text-violet-300">PrzemAI 2.0 · Pulpit operacyjny</p>
      <h1 className="mt-1 break-words text-2xl font-black tracking-tight sm:text-3xl">Centrum <span className="text-violet-300">dowodzenia</span></h1>
      <p className="mt-1 text-xs leading-5 text-slate-300">Finanse, inwestycje i agenci w jednym miejscu.</p>
     </div>
     <button type="button" onClick={()=>setRefresh(v=>v+1)} disabled={loading}
       className="relative inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 text-sm font-semibold text-slate-200 hover:bg-white/10 disabled:opacity-50">
       <RefreshCw size={17} className={loading?"animate-spin":""}/>{loading?"Ładowanie…":"Odśwież dane"}
     </button>
    </div>
    <div className={"mt-4 grid min-w-0 gap-4 "+(!simpleMode?"xl:grid-cols-[minmax(0,1fr)_minmax(240px,280px)]":"")}>
    <div className="min-w-0">
    <section aria-label="Wybór spółki" className="rounded-xl border border-white/10 bg-[#101a30] p-3">
     <div className="flex flex-wrap items-center gap-2">
      <span className="mr-1 text-sm font-bold text-violet-200">Spółka:</span>
      <button type="button" aria-pressed={!primaryCompany} onClick={()=>selectPrimaryCompany("")} className={"min-h-11 rounded-xl px-3 text-xs font-semibold "+(!primaryCompany?"bg-violet-600 text-white":"bg-white/5 text-slate-300")}>Konto osobiste</button>
      {organizations.map(o=><div key={o.id} className={"flex items-center rounded-xl border "+(o.id===primaryCompany?"border-violet-400 bg-violet-600 text-white":"border-white/10 bg-[#1b2745]")}><button type="button" aria-pressed={o.id===primaryCompany} onClick={()=>selectPrimaryCompany(o.id)} className="flex min-h-11 items-center gap-2 px-3 text-xs font-semibold"><Building2 size={16}/>{o.displayName||o.name}</button><Link href={"/company/"+encodeURIComponent(o.id)} aria-label={"Otwórz panel "+(o.displayName||o.name)} className="flex min-h-11 items-center border-l border-white/15 px-2"><ArrowUpRight size={14}/></Link></div>)}
      <Link href="/company/setup" className="ml-auto flex min-h-11 items-center gap-1 text-xs font-semibold text-violet-300"><Plus size={15}/> Spółki</Link>
     </div>
     <p className="mt-2 text-[11px] text-slate-400">Dostępne spółki · bez niezweryfikowanej konsolidacji. Widok nie sumuje danych osobistych ani nie ujawnia danych innych kont.</p>
     {!loading&&organizations.length===0&&<p className="mt-2 text-xs text-amber-200">Nie znaleziono spółek przypisanych do konta.</p>}
     {primaryCompany&&organizations.some(o=>o.id===primaryCompany)&&<details className="mt-3 rounded-xl border border-violet-400/20 bg-[#0a162d] p-3"><summary className="cursor-pointer text-sm font-semibold text-violet-200">Szczegóły synchronizacji KSeF</summary>
      <div className="flex flex-wrap items-center justify-between gap-2">
       <h3 className="text-sm font-bold">KSeF — {organizations.find(o=>o.id===primaryCompany)?.displayName||organizations.find(o=>o.id===primaryCompany)?.name}</h3>
       <Link href={"/company/"+encodeURIComponent(primaryCompany)+"/finance"} className="text-xs text-violet-300">Szczegóły finansów →</Link>
      </div>
      {companyFinanceError?<p role="status" className="mt-3 text-sm text-amber-200">{companyFinanceError} Sprawdź połączenie KSeF i uprawnienia finansowe.</p>:
       !companyFinance?<p className="mt-3 text-sm text-slate-400">Pobieranie danych finansowych…</p>:
       <div className="mt-3 grid gap-3 sm:grid-cols-3">
        {[
         {label:"Sprzedaż KSeF (PLN, brutto)",direction:"OUTGOING"},
         {label:"Zakupy KSeF (PLN, brutto)",direction:"INCOMING"}
        ].map(item=><div key={item.direction} className="rounded-lg bg-white/5 p-3">
         <p className="text-xs text-slate-400">{item.label}</p>
         <p className="mt-1 text-xl font-bold">{(companyFinance.amounts?.find(a=>a.currency==="PLN"&&a.direction===item.direction)?.gross==null?"—":money(companyFinance.amounts.find(a=>a.currency==="PLN"&&a.direction===item.direction).gross))}</p>
        </div>)}
        <div className="rounded-lg bg-white/5 p-3"><p className="text-xs text-slate-400">Faktury KSeF</p><p className="mt-1 text-xl font-bold">{companyFinance.count??"—"}</p></div>
       </div>}
      <p className="mt-3 text-xs text-slate-400">Suma zaimportowanych faktur, nie przychód kasowy. Ostatnia aktywność agenta: {companyFinance?.sync?.lastRunAt?new Date(companyFinance.sync.lastRunAt).toLocaleString("pl-PL"):"brak danych"}.</p>
     </details>}
    </section>
    {errors>0&&<div role="status" className="mt-4 flex items-start gap-2 rounded-xl border border-amber-400/25 bg-amber-400/5 p-3 text-sm text-amber-200">
      <AlertCircle size={18} className="mt-0.5 shrink-0"/>Nie wszystkie moduły odpowiedziały. Brakujących wartości nie zastępujemy przykładowymi danymi.
     </div>}
    <section className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
     <Metric label="Faktury z KSeF" value={ready?(primaryCompany?(selectedOrg?(companyFinance?.count??"—"):"—"):(finance.ksef??"—")):"…"} icon={FileText} accent="blue" foot="Dokumenty pobrane dla bieżącego konta"/>
     <Metric label="Faktury zakupowe PLN" value={ready?(primaryCompany?(selectedOrg&&companyFinance?money(companyFinance.amounts?.find(a=>a.currency==="PLN"&&a.direction==="INCOMING")?.gross):"—"):(data?.finance?money(purchasePLN?.gross):"—")):"…"} icon={Wallet} accent="orange" foot="Łączna wartość brutto faktur, nie płatności"/>
     <Metric label="Faktury sprzedażowe PLN" value={ready?(primaryCompany?(selectedOrg&&companyFinance?money(companyFinance.amounts?.find(a=>a.currency==="PLN"&&a.direction==="OUTGOING")?.gross):"—"):(data?.finance?money(salesPLN?.gross):"—")):"…"} icon={BarChart3} accent="green" foot="Łączna wartość brutto faktur, nie wpływy bankowe"/>
     <Metric label="Włączeni agenci" value={ready?enabled+" / "+agents.length:"…"} icon={Bot} accent="purple" foot="Financial Agent i agenci zleceń"/>
    </section>
    {!simpleMode&&<><div className="mt-3 grid min-w-0 gap-3 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
     <Panel className="p-4 sm:p-5">
      <SectionTitle href="/finance/projects" link="Zarządzaj inwestycjami">Kluczowe inwestycje</SectionTitle>
      <p className="mt-1 text-xs text-slate-400">Projekty dostępne na koncie</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-3">
       {projects.slice(0,3).map(p=><div key={p.id} className="flex min-w-0 flex-col gap-2 overflow-hidden rounded-xl border border-blue-400/20 bg-[#121b32] p-2">
        <span aria-hidden="true" className="flex h-16 items-center justify-center rounded-lg bg-gradient-to-br from-[#234562] to-[#172540] text-blue-200"><Building2 size={32}/></span>
        <div className="min-w-0 flex-1"><strong className="block break-words text-sm">{p.name}</strong><p className="truncate text-xs text-slate-400">{p.company||"Brak określonej spółki"}</p></div>
        <Link href="/finance/projects" aria-label={"Zobacz "+p.name} className="flex min-h-9 items-center justify-between text-xs text-violet-300">Szczegóły <ChevronRight size={16}/></Link>
       </div>)}
       {projects.length===0&&<p className="py-5 text-sm text-slate-400">{loading?"Pobieranie projektów…":"Nie utworzono jeszcze inwestycji."}</p>}
      </div>
     </Panel>
     <Panel className="p-4 sm:p-5">
      <SectionTitle href="/finance/reports" link="Pełne raporty">Sprzedaż i zakupy z faktur · PLN</SectionTitle>
      <p className="mt-1 text-xs text-slate-400">{new Date().getFullYear()} · miesiące · brutto · nie są to przepływy pieniężne</p>
      {reportRows.length===0?<div className="mt-3 flex min-h-[150px] items-center justify-center rounded-xl border border-dashed border-white/10 text-sm text-slate-400">{loading?"Pobieranie zestawienia…":(primaryCompany&&!companyReport?"Nie udało się pobrać zestawienia KSeF wybranej firmy lub brak uprawnień.":"Brak danych faktur do wykresu.")}</div>:
      <div className="mt-3 min-w-0 overflow-x-auto">
       <div className="flex h-36 min-w-[250px] items-end gap-1.5 border-b border-white/15 pb-3 sm:gap-2">
        {shownMonths.map(v=><div key={v.label} className="flex min-w-0 flex-1 flex-col items-center justify-end gap-2">
         <div className="flex h-28 w-full items-end justify-center gap-1">
          <div title={v.label+" sprzedaż "+money(v.sales)} style={{height:Math.max(0,v.sales/chartMax*100)+"%"}}
           className="w-3 max-w-[22px] min-w-[5px] rounded-t bg-violet-500 sm:w-5"/>
          <div title={v.label+" zakupy "+money(v.purchase)} style={{height:Math.max(0,v.purchase/chartMax*100)+"%"}}
           className="w-3 max-w-[22px] min-w-[5px] rounded-t bg-emerald-400 sm:w-5"/>
         </div><span className="text-[10px] font-semibold text-slate-400">{v.label}</span>
        </div>)}
       </div>
       <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-slate-300">
        <span><i className="mr-2 inline-block h-2.5 w-2.5 rounded-sm bg-violet-500"/>Faktury sprzedażowe</span>
        <span><i className="mr-2 inline-block h-2.5 w-2.5 rounded-sm bg-emerald-400"/>Faktury zakupowe</span>
       </div>
      </div>}
     </Panel>
    </div>
     <Panel className="mt-3 p-3"><SectionTitle href="/agents" link="Zarządzaj agentami">Agenci AI · aktywność</SectionTitle><p className="mt-1 text-xs text-slate-400">Status agentów konta · {enabled} / {agents.length} włączonych</p><div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-6">{agents.map(a=><AgentTile key={a.id} agent={a}/>)}{agents.length===0&&<p className="col-span-full py-3 text-sm text-slate-400">{loading?"Pobieranie statusów…":"Brak agentów na koncie."}</p>}</div></Panel>
    </>}
    {<section aria-label="Szybki dostęp" className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
     <SmallLink href="/chat" title="Porozmawiaj z asystentem" icon={MessageSquareText}/>
     <SmallLink href="/agents" title="Agenci AI" icon={Bot}/>
     <SmallLink href="/finance" title="Finanse i KSeF" icon={Wallet}/>
     <SmallLink href="/finance/projects" title="Projekty" icon={FolderKanban}/>
     <SmallLink href="/agents/sales" title="Agent sprzedażowy" icon={Handshake}/>
    </section>}
    <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-[#111c35] px-4 py-3 text-xs leading-5 text-slate-400">
     <Landmark size={17} className="shrink-0 text-slate-300"/>
     <strong className="text-slate-200">Rachunki bankowe:</strong> brak podłączonej bankowości. Salda i wpływy będą dostępne po autoryzacji integracji.
     <Link href="/finance" className="ml-auto font-semibold text-violet-300">Finanse <ArrowUpRight size={12} className="inline"/></Link>
    </div>
    {!simpleMode&&<div className="mt-3 grid min-w-0 gap-3">
     <Panel className="p-4 sm:p-5">
      <SectionTitle href="/finance" link="Otwórz KSeF">KSeF i działania</SectionTitle>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
       <SmallLink href="/finance" title="Faktury KSeF" icon={FileText}/>
       <SmallLink href="/finance/reports" title="Raport finansowy" icon={BarChart3}/>
       <SmallLink href="/agents/sales" title="Agent Sprzedaży" icon={Handshake}/>
       <SmallLink href="/tasks" title="Zadania" icon={CheckCircle2}/>
      </div>
      <div className="mt-5 grid grid-cols-2 gap-3">
       <div className="rounded-xl border border-white/[.06] bg-white/[.025] p-4"><p className="text-2xl font-extrabold">{ready?(summary.openTasks??"—"):"…"}</p><p className="mt-1 text-xs text-slate-400">Otwarte zadania</p></div>
       <div className="rounded-xl border border-white/[.06] bg-white/[.025] p-4"><p className="text-2xl font-extrabold">{ready?(summary.overdueTasks??"—"):"…"}</p><p className="mt-1 text-xs text-slate-400">Po terminie</p></div>
      </div>
     </Panel>
    </div>}
    {!simpleMode&&<div className="mt-4 grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
     <Panel className="p-4 sm:p-5">
      <SectionTitle href="/chat" link="Otwórz asystenta">Asystent PrzemAI</SectionTitle>
      <p className="mt-3 text-sm leading-6 text-slate-300">Rozmawiaj z asystentem, zlecaj przygotowanie dokumentów i sprawdzaj swoje zadania.</p>
      <Link href="/chat" className="mt-4 flex min-h-14 items-center justify-between gap-3 rounded-xl border border-violet-400/25 bg-violet-500/10 px-4 text-sm text-slate-200 hover:bg-violet-500/15">
       <span>W czym mogę dziś pomóc?</span><MessageSquareText className="text-violet-300" size={19}/>
      </Link>
      <p className="mt-3 text-xs text-slate-500">Asystent nie wysyła wiadomości ani nie wykonuje przelewów bez upoważnienia.</p>
     </Panel>
     <Panel className="p-4 sm:p-5">
      <SectionTitle href="/company/setup" link="Panel grupy">Twoje spółki</SectionTitle>
      <label className="mt-3 block text-xs text-slate-400">Filtruj nazwy spółek
       <input value={companySearch} onChange={e=>setCompanySearch(e.target.value)} placeholder="Wpisz nazwę…"
        className="mt-1 block w-full rounded-xl border border-white/15 bg-[#0c1630] p-3 text-sm text-white"/>
      </label>
      <div className="mt-3 space-y-2">
       {filteredCompanies.slice(0,5).map(o=><Link href={"/company/"+encodeURIComponent(o.id)} key={o.id}
        className="flex items-center justify-between gap-3 rounded-lg bg-white/[.035] px-3 py-2 text-sm text-slate-300 hover:bg-white/10">
         <span className="min-w-0 truncate">{o.displayName||o.name}</span><ChevronRight size={16}/>
       </Link>)}
       {filteredCompanies.length===0&&<p className="py-3 text-xs text-slate-400">Brak spółek odpowiadających filtrowi.</p>}
      </div>
      <p className="mt-4 text-xs leading-5 text-slate-500">Firmy mają własne zadania i członków zespołu. Finanse dotyczą wybranego konta lub spółki — nie skonsolidowanej księgowości grupy.</p>
     </Panel>
    </div>}
    {!simpleMode&&<div className="mt-4 flex flex-wrap gap-2">
     <SmallLink href="/document" title="Dodaj dokument" icon={FileText}/>
     <SmallLink href="/meeting" title="Nowe spotkanie" icon={Mic}/>
     <SmallLink href="/agents" title="Wszyscy agenci" icon={Bot}/>
     <SmallLink href="/company/setup" title="Dodaj spółkę" icon={Plus}/>
    </div>
    }
    </div>
    {!simpleMode&&<aside aria-label="Centrum działań" className="min-w-0 space-y-4">
     <Panel className="border-violet-400/30 bg-gradient-to-br from-[#261847] to-[#131b32] p-4">
      <SectionTitle href="/chat" link="Otwórz">Asystent PrzemAI</SectionTitle>
      <Link href="/chat" className="mt-4 flex min-h-12 items-center justify-between gap-2 rounded-xl border border-violet-400/40 bg-violet-500/15 p-3 text-sm">W czym mogę pomóc?<MessageSquareText size={18}/></Link>
      <div className="mt-3 space-y-2"><SmallLink href="/finance/reports" title="Raporty finansowe" icon={BarChart3}/><SmallLink href="/finance/projects" title="Status inwestycji" icon={FolderKanban}/><SmallLink href="/tasks" title="Sprawdź zadania" icon={CheckCircle2}/></div>
     </Panel>
     <Panel className="p-4"><SectionTitle href="/tasks" link="Otwórz">Przypomnienia i zadania</SectionTitle><div className="mt-4 grid grid-cols-2 gap-2"><div className="rounded-xl bg-violet-500/10 p-3"><p className="text-xl font-bold">{ready?(summary.openTasks??"—"):"…"}</p><p className="text-xs text-slate-300">Otwarte</p></div><div className="rounded-xl bg-amber-500/10 p-3"><p className="text-xl font-bold">{ready?(summary.overdueTasks??"—"):"…"}</p><p className="text-xs text-slate-300">Po terminie</p></div></div></Panel>
     <CalendarPanel/>
     <Panel className="p-3"><SectionTitle>Przestrzenie firm</SectionTitle><div className="mt-3 space-y-2">{organizations.map(o=><SmallLink key={o.id} href={"/company/"+encodeURIComponent(o.id)} title={o.displayName||o.name} icon={Building2}/>)}</div></Panel>
    </aside>}
    </div>
    <footer className="mt-7 border-t border-white/10 pt-4 text-xs text-slate-500">
     PrzemAI · Dane rzeczywiste dostępne dla zalogowanego użytkownika · Połączenia bankowe i konsolidacja grupy wymagają integracji.
    </footer>
   </div>
  </div>
 </main>;
}
