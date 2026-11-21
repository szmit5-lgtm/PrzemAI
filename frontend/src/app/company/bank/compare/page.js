"use client";
import {useEffect,useState} from "react";
import Link from "next/link";
import {ArrowLeft,Building2,Landmark,RefreshCw,ShieldCheck,Info} from "lucide-react";
import Navbar from "../../../components/Navbar";
import UserMenu from "../../../components/UserMenu";
import {getOrganizations,getOrganizationBankMonthlyReport} from "@/lib/api";

const MONTHS=["Styczeń","Luty","Marzec","Kwiecień","Maj","Czerwiec",
 "Lipiec","Sierpień","Wrzesień","Październik","Listopad","Grudzień"];
const cash=(value,currency="PLN")=>{
 if(value===null||value===undefined)return "—";
 const n=Number(value);
 if(!Number.isFinite(n))return "—";
 try{return new Intl.NumberFormat("pl-PL",{style:"currency",currency}).format(n);}
 catch{return String(value)+" "+currency;}
};
export default function BankCompanyComparisonPage(){
 const now=new Date();
 const [year,setYear]=useState(now.getFullYear());
 const [draft,setDraft]=useState(String(now.getFullYear()));
 const [month,setMonth]=useState(10);
 const [companies,setCompanies]=useState([]);
 const [results,setResults]=useState([]);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState("");
 const [refresh,setRefresh]=useState(0);
 useEffect(()=>{
  let active=true;
  setLoading(true);setError("");setCompanies([]);setResults([]);
  getOrganizations().then(async response=>{
   const selected=(Array.isArray(response?.data)?response.data:[])
    .filter(org=>org.role==="OWNER"&&org.status==="ACTIVE");
   if(selected.length>15)throw Error("Zbyt wiele spółek w zestawieniu. Skontaktuj się z administratorem.");
   const outcome=await Promise.all(selected.map(async org=>{
    try{
     const res=await getOrganizationBankMonthlyReport(org.id,year);
     if(res?.data?.organizationId!==org.id||res?.data?.year!==year||!Array.isArray(res?.data?.months)){
      throw Error("Serwer nie potwierdził danych tej spółki.");
     }
     return {id:org.id,report:res.data};
    }catch(err){return {id:org.id,error:err?.message||"Brak raportu"};}
   }));
   if(!active)return;
   setCompanies(selected);
   setResults(outcome);
  }).catch(err=>{if(active)setError(err?.message||"Nie udało się pobrać raportów spółek.");})
   .finally(()=>{if(active)setLoading(false);});
  return ()=>{active=false;};
 },[year,refresh]);
 function chooseYear(e){
  e.preventDefault();
  const value=Number(draft);
  if(!Number.isInteger(value)||value<2020||value>2100){
   setError("Wybierz rok od 2020 do 2100.");return;
  }
  setYear(value);setRefresh(x=>x+1);
 }
 const rows=companies.map(org=>{
  const result=results.find(row=>row.id===org.id);
  const matched=result?.report?.months?.find(row=>row.month===month);
  const summary=matched?.currencies?.find(c=>c.currency==="PLN")||null;
  return {org,result,summary,accounts:matched?.accounts||[]};
 });
 return <main className="min-h-screen min-w-0 overflow-x-clip bg-[#080e20] px-3 py-5 pb-24 text-slate-100 sm:px-6 lg:px-8">
  <div className="mx-auto max-w-7xl">
   <header className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-[#111c35] p-4">
    <Link href="/" className="inline-flex min-h-11 items-center gap-2 text-sm text-violet-200"><ArrowLeft size={18}/> Pulpit</Link>
    <UserMenu/>
   </header>
   <Navbar/>
   <section className="mt-5 rounded-3xl border border-violet-400/25 bg-gradient-to-r from-[#221747] to-[#113756] p-5 sm:p-7">
    <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-violet-200"><Building2 size={16}/> Porównanie spółek</p>
    <h1 className="mt-3 text-2xl font-black sm:text-4xl">Stan banków — Dekonica, Deherus i inne spółki</h1>
    <p className="mt-3 text-sm leading-6 text-slate-200">Wspólna tabela porównawcza, ale każda spółka pozostaje osobnym źródłem danych. Widok jest dostępny wyłącznie dla właściciela danej spółki.</p>
   </section>
   <form onSubmit={chooseYear} className="mt-5 flex flex-wrap items-end gap-3 rounded-2xl border border-white/10 bg-[#111c35] p-4">
    <label className="text-sm font-semibold">Rok
     <input type="number" min="2020" max="2100" step="1" value={draft} onChange={e=>setDraft(e.target.value)}
      className="mt-2 block min-h-11 w-32 rounded-xl border border-white/15 bg-[#0c1930] px-3"/>
    </label>
    <label className="text-sm font-semibold">Miesiąc
     <select value={month} onChange={e=>setMonth(Number(e.target.value))}
      className="mt-2 block min-h-11 w-40 rounded-xl border border-white/15 bg-[#0c1930] px-3">
      {MONTHS.map((label,i)=><option key={i} value={i+1}>{label}</option>)}
     </select>
    </label>
    <button type="submit" disabled={loading} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-violet-600 px-4 text-sm font-bold text-white disabled:opacity-50">
     <RefreshCw size={16}/> Porównaj
    </button>
   </form>
   {loading&&<p role="status" className="mt-5 text-sm text-slate-300">Pobieram niezależne zestawienia spółek…</p>}
   {error&&<p role="alert" className="mt-5 rounded-xl border border-rose-400/30 bg-rose-500/10 p-4 text-sm text-rose-200">{error}</p>}
   {!loading&&!error&&<>
    <section className="mt-5 rounded-2xl border border-white/10 bg-[#111c35] p-4 sm:p-6">
     <h2 className="text-xl font-bold">Porównanie na {new Date(Date.UTC(year,month,0)).toLocaleDateString("pl-PL")}</h2>
     <p className="mt-2 text-xs text-slate-400">Wszystkie wartości w PLN. Puste pola oznaczają brak zweryfikowanego salda za dany miesiąc, nie zero.</p>
     <div className="mt-4 overflow-x-auto rounded-xl border border-white/10">
      <table className="w-full min-w-[900px] border-collapse text-left text-sm">
       <thead className="bg-white/5 text-xs text-slate-300"><tr>
        {["Spółka","Rachunek bieżący","Rachunek VAT","Razem","Wpływy w miesiącu","Wydatki w miesiącu"].map(h=><th key={h} className="px-3 py-3">{h}</th>)}
       </tr></thead>
       <tbody>{rows.map(({org,result,summary})=><tr key={org.id} className="border-t border-white/10">
        <td className="px-3 py-4 font-bold"><Link className="text-violet-200 hover:underline" href={"/company/"+encodeURIComponent(org.id)+"/bank/reports"}>{org.displayName||org.name}</Link></td>
        <td className="px-3 py-4 tabular-nums">{summary?cash(summary.currentBalance):"—"}</td>
        <td className="px-3 py-4 tabular-nums">{summary?cash(summary.vatBalance):"—"}</td>
        <td className="px-3 py-4 font-bold tabular-nums">{summary?cash(summary.balance):"—"}</td>
        <td className="px-3 py-4 tabular-nums">{summary?cash(summary.inflows):"—"}</td>
        <td className="px-3 py-4 tabular-nums">{summary?cash(summary.outflows):"—"}</td>
       </tr>)}</tbody>
      </table>
     </div>
     {!companies.length&&<p className="mt-4 text-sm text-slate-300">Brak aktywnych spółek, w których masz rolę właściciela.</p>}
     {rows.filter(x=>x.result?.error).map(x=><p key={x.org.id} role="status" className="mt-3 flex items-start gap-2 text-xs text-amber-200">
      <Info size={15} className="shrink-0"/> {x.org.displayName||x.org.name}: {x.result.error}
     </p>)}
    </section>
    <p className="mt-5 flex items-start gap-2 text-xs leading-5 text-slate-400"><ShieldCheck size={16} className="shrink-0"/>
     Porównujemy spółki bez przenoszenia ich dokumentów lub transakcji między przestrzeniami. Rachunki VAT są pokazane osobno, ponieważ środki na nich mają ograniczone zastosowanie.
    </p>
   </>}
  </div>
 </main>;
}
