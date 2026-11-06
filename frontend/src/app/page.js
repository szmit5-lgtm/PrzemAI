"use client";

import {useEffect,useMemo,useState} from "react";
import Link from "next/link";
import {Activity,ArrowUpRight,BarChart3,Bot,BriefcaseBusiness,
 Building2,CalendarDays,CheckCircle2,ChevronRight,Clock3,FileText,
 FolderKanban,Handshake,Landmark,MessageSquareText,Mic,Plus,
 RefreshCw,ShieldCheck,Wallet,Workflow,AlertCircle} from "lucide-react";
import Navbar from "./components/Navbar";
import UserMenu from "./components/UserMenu";
import {
 getAgents,getExecutiveDashboard,getFinanceSummary,getFinanceProjects,
 getOrganizations,getFinancePeriodReport
} from "@/lib/api";

const months=["Sty","Lut","Mar","Kwi","Maj","Cze","Lip","Sie","Wrz","Paź","Lis","Gru"];
const money=(value,currency="PLN")=>{
 const n=Number(value);
 return Number.isFinite(n)?new Intl.NumberFormat("pl-PL",
  {style:"currency",currency,maximumFractionDigits:0}).format(n):"—";
};
const readValue=(result,key)=>result.status==="fulfilled"?result.value?.[key]:null;
function Panel({children,className=""}) {
 return <section className={"min-w-0 overflow-hidden rounded-[22px] border border-white/10 bg-[#111c35]/95 shadow-[0_12px_35px_rgba(0,0,0,.12)] "+className}>{children}</section>;
}
function SectionTitle({children,href,link="Pokaż wszystkie"}) {
 return <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
  <h2 className="break-words text-base font-bold sm:text-lg">{children}</h2>
  {href&&<Link href={href} className="inline-flex items-center gap-1 text-xs font-semibold text-violet-300 hover:text-violet-200">{link}<ArrowUpRight size={13}/></Link>}
 </div>;
}
function Metric({label,value,icon:Icon,foot,accent="blue"}) {
 const theme={
  blue:"bg-blue-500/15 text-blue-300",green:"bg-emerald-500/15 text-emerald-300",
  purple:"bg-violet-500/15 text-violet-300",orange:"bg-amber-500/15 text-amber-300"
 }[accent];
 return <Panel className="p-4 sm:p-5">
  <div className="flex items-start justify-between gap-3">
   <span className={"rounded-xl p-2.5 "+theme}><Icon size={21}/></span>
   <span className="text-[10px] text-slate-500">DANE Z SYSTEMU</span>
  </div>
  <p className="mt-4 break-words text-2xl font-extrabold tracking-tight tabular-nums text-white xl:text-3xl">{value}</p>
  <p className="mt-1 text-sm font-medium text-slate-200">{label}</p>
  <p className="mt-2 text-xs leading-5 text-slate-400">{foot}</p>
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
 const agents=Array.isArray(data?.agents)?data.agents:[];
 const projects=Array.isArray(data?.projects)?data.projects:[];
 const organizations=Array.isArray(data?.organizations)?data.organizations:[];
 const summary=data?.executive?.summary||{};
 const finance=data?.finance||{};
 const amounts=Array.isArray(finance.amounts)?finance.amounts:[];
 // Different currencies must never be added to PLN.
 const purchasePLN=amounts.find(a=>a.currency==="PLN"&&a.direction==="INCOMING");
 const salesPLN=amounts.find(a=>a.currency==="PLN"&&a.direction==="OUTGOING");
 const enabled=agents.filter(a=>a.enabled).length;
 const reportRows=Array.isArray(data?.report?.rows)?data.report.rows:[];
 const chart=useMemo(()=>months.map((label,index)=>{
   const rows=reportRows.filter(r=>r.period==="MONTH"&&r.number===index+1&&r.currency==="PLN");
   const total=group=>rows.filter(r=>r.group===group).reduce((s,r)=>s+Number(r.gross||0),0);
   return {label,sales:total("INVOICED_SALES"),purchase:total("INVOICED_PURCHASES")};
 }),[reportRows]);
 const chartMax=Math.max(1,...chart.flatMap(r=>[r.sales,r.purchase]));
 const nowMonth=new Date().getMonth();
 const shownMonths=chart.slice(0,Math.max(3,nowMonth+1));
 const filteredCompanies=organizations.filter(o=>
  (o.displayName||o.name||"").toLocaleLowerCase("pl-PL").includes(companySearch.toLocaleLowerCase("pl-PL")));
 const ready=data!==null;
 return <main className="min-h-screen min-w-0 bg-[#080e20] text-slate-100">
  <div className="mx-auto grid min-h-screen max-w-[1900px] min-w-0 lg:grid-cols-[242px_minmax(0,1fr)]">
   <aside className="hidden min-w-0 border-r border-white/10 bg-[#0a1227] px-3 py-5 lg:flex lg:flex-col">
    <Link href="/" className="flex items-center gap-3 px-3 py-2 text-xl font-black tracking-tight">
     <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-600 text-2xl font-black text-white">P</span>
     Przem<span className="text-violet-300">AI</span>
    </Link>
    <div className="mt-4 border-t border-white/10 pt-5">
     <Navbar vertical/>
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
   <div className="min-w-0 px-3 pb-9 pt-4 sm:px-6 lg:px-7 2xl:px-9">
    <header className="flex min-w-0 flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-[#111c35] px-4 py-3 sm:px-5">
     <div className="flex min-w-0 items-center gap-3">
      <span className="rounded-xl bg-violet-500/15 p-2 text-violet-300 lg:hidden"><Bot size={21}/></span>
      <div className="min-w-0">
       <p className="truncate text-sm font-bold sm:text-base">PrzemAI <span className="ml-2 font-normal text-slate-400">Panel operacyjny</span></p>
       <p className="truncate text-[11px] text-slate-500">Agenci · Finanse · Inwestycje</p>
      </div>
     </div>
     <UserMenu/>
    </header>
    <div className="lg:hidden"><Navbar/></div>
    <div className="mt-6 flex min-w-0 flex-wrap items-start justify-between gap-4">
     <div className="min-w-0 flex-1">
      <p className="text-xs font-bold uppercase tracking-[.17em] text-violet-300">PrzemAI / Pulpit</p>
      <h1 className="mt-2 break-words text-3xl font-black tracking-tight sm:text-4xl">Dzień dobry <span aria-hidden="true">👋</span></h1>
      <p className="mt-2 text-sm text-slate-400">Bieżące informacje z konta osobistego i działających agentów. Przestrzenie firmowe otwieraj osobno.</p>
     </div>
     <button type="button" onClick={()=>setRefresh(v=>v+1)} disabled={loading}
       className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 text-sm font-semibold text-slate-200 hover:bg-white/10 disabled:opacity-50">
       <RefreshCw size={17} className={loading?"animate-spin":""}/>{loading?"Ładowanie…":"Odśwież dane"}
     </button>
    </div>
    {errors>0&&<div role="status" className="mt-4 flex items-start gap-2 rounded-xl border border-amber-400/25 bg-amber-400/5 p-3 text-sm text-amber-200">
      <AlertCircle size={18} className="mt-0.5 shrink-0"/>Nie wszystkie moduły odpowiedziały. Brakujących wartości nie zastępujemy przykładowymi danymi.
     </div>}
    <section className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
     <Metric label="Faktury z KSeF" value={ready?(finance.ksef??"—"):"…"} icon={FileText} accent="blue" foot="Dokumenty pobrane dla bieżącego konta"/>
     <Metric label="Faktury zakupowe PLN" value={ready?(data?.finance?money(purchasePLN?.gross??0):"—"):"…"} icon={Wallet} accent="orange" foot="Łączna wartość brutto faktur, nie płatności"/>
     <Metric label="Faktury sprzedażowe PLN" value={ready?(data?.finance?money(salesPLN?.gross??0):"—"):"…"} icon={BarChart3} accent="green" foot="Łączna wartość brutto faktur, nie wpływy bankowe"/>
     <Metric label="Włączeni agenci" value={ready?enabled+" / "+agents.length:"…"} icon={Bot} accent="purple" foot="Financial Agent i agenci zleceń"/>
    </section>
    <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-[#111c35] px-4 py-3 text-xs leading-5 text-slate-400">
     <Landmark size={17} className="shrink-0 text-slate-300"/>
     <strong className="text-slate-200">Rachunki bankowe:</strong> brak podłączonej bankowości. Salda i wpływy będą dostępne po autoryzacji integracji.
     <Link href="/finance" className="ml-auto font-semibold text-violet-300">Finanse <ArrowUpRight size={12} className="inline"/></Link>
    </div>
    <div className="mt-5 grid min-w-0 gap-4 2xl:grid-cols-[minmax(0,1.65fr)_minmax(290px,1fr)]">
     <Panel className="p-4 sm:p-5">
      <SectionTitle href="/finance/reports" link="Pełne raporty">Sprzedaż i zakupy z faktur · PLN</SectionTitle>
      <p className="mt-1 text-xs text-slate-400">{new Date().getFullYear()} · miesiące · brutto · nie są to przepływy pieniężne</p>
      {reportRows.length===0?<div className="mt-7 flex min-h-[208px] items-center justify-center rounded-xl border border-dashed border-white/10 text-sm text-slate-400">{loading?"Pobieranie zestawienia…":"Brak danych faktur do wykresu."}</div>:
      <div className="mt-7 min-w-0 overflow-x-auto">
       <div className="flex h-52 min-w-[390px] items-end gap-1.5 border-b border-white/15 pb-3 sm:gap-2">
        {shownMonths.map(v=><div key={v.label} className="flex min-w-0 flex-1 flex-col items-center justify-end gap-2">
         <div className="flex h-40 w-full items-end justify-center gap-1">
          <div title={v.label+" sprzedaż "+money(v.sales)} style={{height:Math.max(2,v.sales/chartMax*100)+"%"}}
           className="w-3 max-w-[22px] min-w-[5px] rounded-t bg-blue-500 sm:w-5"/>
          <div title={v.label+" zakupy "+money(v.purchase)} style={{height:Math.max(2,v.purchase/chartMax*100)+"%"}}
           className="w-3 max-w-[22px] min-w-[5px] rounded-t bg-violet-400 sm:w-5"/>
         </div><span className="text-[10px] font-semibold text-slate-400">{v.label}</span>
        </div>)}
       </div>
       <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-slate-300">
        <span><i className="mr-2 inline-block h-2.5 w-2.5 rounded-sm bg-blue-500"/>Faktury sprzedażowe</span>
        <span><i className="mr-2 inline-block h-2.5 w-2.5 rounded-sm bg-violet-400"/>Faktury zakupowe</span>
       </div>
      </div>}
     </Panel>
     <Panel className="p-4 sm:p-5">
      <SectionTitle href="/agents" link="Wszyscy agenci">Agenci AI · status</SectionTitle>
      <p className="mt-1 text-xs text-slate-400">Stan z produkcyjnego panelu agentów</p>
      <div className="mt-3 max-h-64 divide-y divide-white/[.06] overflow-y-auto">
       {agents.length===0&&<p className="py-6 text-sm text-slate-400">{loading?"Pobieranie statusów…":"Brak agentów na koncie."}</p>}
       {agents.map(a=><Link key={a.id} href={a.key==="financial"?"/finance":"/agents/"+a.key}
        className="flex min-w-0 items-center gap-3 py-2.5 hover:bg-white/[.035]">
        <span className={"h-2 w-2 shrink-0 rounded-full "+(a.status==="RUNNING"?"bg-amber-400":a.enabled?"bg-emerald-400":"bg-slate-500")}/>
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-500/10 text-violet-300"><Bot size={17}/></span>
        <span className="min-w-0 flex-1">
         <strong className="block truncate text-xs text-white">{a.name}</strong>
         <span className="block truncate text-[11px] text-slate-400">{a.headline||a.type}</span>
        </span>
        <span className={"shrink-0 text-[11px] "+(a.enabled?"text-emerald-300":"text-slate-400")}>
         {a.status==="RUNNING"?"Pracuje":a.enabled?"Włączony":"Wyłączony"}
        </span>
       </Link>)}
      </div>
     </Panel>
    </div>
    <div className="mt-4 grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
     <Panel className="p-4 sm:p-5">
      <SectionTitle href="/finance/projects" link="Zarządzaj inwestycjami">Projekty i inwestycje</SectionTitle>
      <p className="mt-1 text-xs text-slate-400">Projekty zapisane na koncie · bez fikcyjnych procentów postępu</p>
      <div className="mt-3 space-y-2">
       {projects.slice(0,5).map(p=><div key={p.id} className="flex min-w-0 items-center gap-3 rounded-xl border border-white/[.06] bg-white/[.025] p-3">
        <span className="rounded-lg bg-blue-500/15 p-2 text-blue-300"><Building2 size={17}/></span>
        <div className="min-w-0 flex-1"><strong className="block truncate text-sm">{p.name}</strong><p className="truncate text-xs text-slate-400">{p.company||"Brak określonej spółki"}</p></div>
        <Link href="/finance/projects" aria-label={"Zobacz "+p.name} className="text-violet-300"><ChevronRight size={18}/></Link>
       </div>)}
       {projects.length===0&&<p className="py-5 text-sm text-slate-400">{loading?"Pobieranie projektów…":"Nie utworzono jeszcze inwestycji."}</p>}
      </div>
     </Panel>
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
    </div>
    <div className="mt-4 grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
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
      <p className="mt-4 text-xs leading-5 text-slate-500">Firmy mają własne zadania i członków zespołu. Powyższe finanse są nadal danymi konta osobistego — nie skonsolidowaną księgowością spółek.</p>
     </Panel>
    </div>
    <div className="mt-4 flex flex-wrap gap-2">
     <SmallLink href="/document" title="Dodaj dokument" icon={FileText}/>
     <SmallLink href="/meeting" title="Nowe spotkanie" icon={Mic}/>
     <SmallLink href="/agents" title="Wszyscy agenci" icon={Bot}/>
     <SmallLink href="/company/setup" title="Dodaj spółkę" icon={Plus}/>
    </div>
    <footer className="mt-7 border-t border-white/10 pt-4 text-xs text-slate-500">
     PrzemAI · Dane rzeczywiste dostępne dla zalogowanego użytkownika · Połączenia bankowe i konsolidacja grupy wymagają integracji.
    </footer>
   </div>
  </div>
 </main>;
}
