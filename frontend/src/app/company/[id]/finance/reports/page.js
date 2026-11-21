"use client";
import {useEffect,useMemo,useState} from "react";
import {useParams} from "next/navigation";
import Link from "next/link";
import {ArrowLeft,BarChart3,RefreshCw,ShieldCheck} from "lucide-react";
import Navbar from "../../../../components/Navbar";
import UserMenu from "../../../../components/UserMenu";
import {getOrganization,getOrganizationFinanceAnnualReport} from "@/lib/api";
import {groupKsefPeriods,formatKsefCents} from "@/lib/financePeriodRows";

const DIRECTION={INCOMING:"Faktury zakupowe",OUTGOING:"Faktury sprzedażowe"};
const MONTHS=["Styczeń","Luty","Marzec","Kwiecień","Maj","Czerwiec",
 "Lipiec","Sierpień","Wrzesień","Październik","Listopad","Grudzień"];
const TABLE_HEADINGS=["Okres","Rodzaj","Waluta","Liczba faktur","Kwota brutto"];

function SummaryTable({items,quarterly=false}) {
 return <div className="mt-3 overflow-x-auto rounded-xl border border-white/10">
  <table className="w-full min-w-[620px] border-collapse text-left text-sm">
   <thead className="bg-white/5 text-xs text-slate-300">
    <tr>{TABLE_HEADINGS.map(h=><th key={h} className="px-3 py-3 font-bold">{h}</th>)}</tr>
   </thead>
   <tbody>
    {items.map(item=><tr key={item.period+"|"+item.direction+"|"+item.currency}
      className="border-t border-white/10">
     <td className="px-3 py-3 font-semibold">{quarterly?"Q"+item.period:MONTHS[item.period-1]}</td>
     <td className="px-3 py-3">{DIRECTION[item.direction]||item.direction}</td>
     <td className="px-3 py-3">{item.currency}</td>
     <td className="px-3 py-3 tabular-nums">{item.count.toLocaleString("pl-PL")}</td>
     <td className="px-3 py-3 font-bold tabular-nums">{formatKsefCents(item.grossCents,item.currency)}</td>
    </tr>)}
   </tbody>
  </table>
  {!items.length&&<p className="p-5 text-sm text-slate-400">Brak zaimportowanych faktur KSeF w wybranym okresie. Nie oznacza to braku operacji gospodarczych.</p>}
 </div>;
}

export default function CompanyKsefReportsPage(){
 const {id}=useParams();
 const currentYear=new Date().getFullYear();
 const [yearDraft,setYearDraft]=useState(String(currentYear));
 const [year,setYear]=useState(currentYear);
 const [companyName,setCompanyName]=useState("");
 const [rows,setRows]=useState([]);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState("");
 const [stamp,setStamp]=useState(0);
 useEffect(()=>{
  if(!id)return;
  let active=true;
  setLoading(true);setError("");setRows([]);
  Promise.all([getOrganization(id),getOrganizationFinanceAnnualReport(id,year)])
   .then(([org,report])=>{
    if(!active)return;
    if(org?.data?.id!==id||report?.data?.year!==year||!Array.isArray(report?.data?.rows)||
      report?.data?.source!=="KSEF")throw Error("Serwer nie potwierdził danych raportu tej spółki.");
    setCompanyName(org.data.displayName||org.data.name||"");
    setRows(report.data.rows);
   }).catch(err=>{if(active)setError(err?.message||"Nie udało się pobrać raportu KSeF.");})
    .finally(()=>{if(active)setLoading(false);});
  return()=>{active=false;};
 },[id,year,stamp]);
 const monthly=useMemo(()=>groupKsefPeriods(rows),[rows]);
 const quarterly=useMemo(()=>groupKsefPeriods(rows,{quarterly:true}),[rows]);
 function selectYear(event){
  event.preventDefault();
  const value=Number(yearDraft);
  if(!Number.isInteger(value)||value<2020||value>2100){setError("Podaj rok od 2020 do 2100.");return;}
  setYear(value);setStamp(t=>t+1);
 }
 return <main className="min-h-screen min-w-0 overflow-x-clip bg-[#080e20] px-3 py-5 pb-24 text-slate-100 sm:px-6 lg:px-8">
  <div className="mx-auto max-w-7xl">
   <header className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-[#111c35] p-4">
    <Link href={"/company/"+encodeURIComponent(id)+"/finance"} className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-violet-200">
      <ArrowLeft size={18}/> Finanse spółki
    </Link><UserMenu/>
   </header>
   <Navbar/>
   <section className="mt-4 rounded-3xl border border-violet-400/25 bg-gradient-to-r from-[#201641] to-[#123955] p-5 sm:p-7">
    <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-violet-200">
     <BarChart3 size={16}/> Raportowanie firmowe · KSeF
    </p>
    <h1 className="mt-3 break-words text-2xl font-black sm:text-3xl">Raport miesięczny i kwartalny — {companyName||"spółka"}</h1>
    <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-200">
     Liczba i wartości brutto faktur zakupowych i sprzedażowych filtrowanych po NIP tej spółki.
     Kwoty nie są saldem bankowym ani potwierdzeniem zapłaty. Waluty pozostają rozdzielone.
    </p>
   </section>
   <form onSubmit={selectYear} className="mt-5 flex flex-wrap items-end gap-3 rounded-2xl border border-white/10 bg-[#111c35] p-4">
    <label className="text-sm font-semibold">Rok raportu
     <input type="number" min="2020" max="2100" step="1"
      value={yearDraft} onChange={e=>setYearDraft(e.target.value)}
      className="mt-2 block min-h-11 w-40 rounded-xl border border-white/20 bg-[#0c1730] px-3"/>
    </label>
    <button type="submit" disabled={loading}
      className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-violet-600 px-5 text-sm font-bold disabled:opacity-50">
      <RefreshCw size={16}/> Pokaż raport
    </button>
    <p className="text-xs text-slate-400">Rok danych: {year}</p>
   </form>
   {loading&&<p role="status" className="mt-6 text-sm text-slate-300">Pobieram rzeczywiste dane faktur KSeF…</p>}
   {error&&<p role="alert" className="mt-5 rounded-xl border border-rose-400/30 bg-rose-500/10 p-4 text-sm text-rose-200">{error}</p>}
   {!loading&&!error&&<>
    <section className="mt-5 rounded-2xl border border-white/10 bg-[#111c35] p-4 sm:p-6">
     <h2 className="text-lg font-bold">Zestawienie miesięczne · {year}</h2>
     <p className="mt-2 text-xs text-slate-400">Wartości brutto według daty wystawienia faktury. Brak miesiąca oznacza brak dostępnych rekordów KSeF.</p>
     <SummaryTable items={monthly}/>
    </section>
    <section className="mt-5 rounded-2xl border border-white/10 bg-[#111c35] p-4 sm:p-6">
     <h2 className="text-lg font-bold">Zestawienie kwartalne · {year}</h2>
     <p className="mt-2 text-xs text-slate-400">Sumy faktur w obrębie waluty i kierunku, bez mieszania zakupów ze sprzedażą.</p>
     <SummaryTable items={quarterly} quarterly/>
    </section>
   </>}
   <p className="mt-5 flex items-start gap-2 text-xs leading-5 text-slate-400"><ShieldCheck className="shrink-0" size={16}/>
    Raport jest dostępny tylko osobom z indywidualnym dostępem do finansów spółki. Nie zastępuje księgowości ani analizy zapłaconych faktur.
   </p>
  </div>
 </main>;
}
