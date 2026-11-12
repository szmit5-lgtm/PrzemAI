"use client";
import Link from "next/link";
import {useParams} from "next/navigation";
import {useEffect,useState} from "react";
import {ArrowLeft,Landmark,FileUp,ShieldAlert,Wallet} from "lucide-react";
import Navbar from "../../../components/Navbar";
import UserMenu from "../../../components/UserMenu";
import {getOrganizationFinanceStatus,getOrganizationWorkspace} from "@/lib/api";

export default function CompanyBankPage(){
 const {id}=useParams();
 const [name,setName]=useState("");
 const [status,setStatus]=useState(null);
 const [error,setError]=useState("");
 const [loading,setLoading]=useState(true);
 useEffect(()=>{
  if(!id)return;
  let alive=true;setLoading(true);setError("");
  Promise.all([getOrganizationWorkspace(id),getOrganizationFinanceStatus(id)])
   .then(([workspace,finance])=>{
    if(!alive)return;
    setName(workspace?.data?.company?.displayName||workspace?.data?.company?.name||"");
    setStatus(finance?.data||{});
   }).catch(e=>{if(alive)setError(e.message||"Brak dostępu do firmy.");})
   .finally(()=>{if(alive)setLoading(false);});
  return()=>{alive=false;};
 },[id]);
 return <main className="min-h-screen bg-[#080e20] px-3 py-5 text-slate-100 sm:px-6">
  <div className="mx-auto max-w-7xl">
   <header className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-[#111c35] p-4">
    <Link href={"/company/"+encodeURIComponent(id)+"/finance"} className="inline-flex items-center gap-2 text-sm text-violet-200"><ArrowLeft size={18}/> Finanse firmy</Link>
    <UserMenu/>
   </header>
   <Navbar/>
   <div className="mt-7">
    <p className="text-xs font-bold uppercase tracking-widest text-violet-300">Przestrzeń firmowa / Bank</p>
    <h1 className="mt-2 text-3xl font-black">Bank i rozliczenia {name}</h1>
    <p className="mt-3 text-sm text-slate-300">Rachunki, wyciągi, salda oraz uzgadnianie płatności z fakturami KSeF.</p>
   </div>
   {loading&&<p className="mt-6 text-slate-400">Sprawdzanie uprawnień…</p>}
   {error&&<p role="alert" className="mt-6 rounded-xl border border-rose-400/30 p-4 text-rose-200">{error}</p>}
   {!loading&&!error&&status&&!status.canView&&<section className="mt-6 rounded-2xl border border-amber-400/20 bg-[#111c35] p-6">
    <ShieldAlert className="text-amber-300"/>
    <h2 className="mt-3 font-bold">Brak uprawnień finansowych</h2>
    <p className="mt-2 text-sm text-slate-300">Dostęp do danych bankowych wymaga osobnego uprawnienia do finansów tej spółki.</p>
   </section>}
   {!loading&&!error&&status?.canView&&<>
    <section className="mt-6 grid gap-3 sm:grid-cols-3">
     {[["Saldo rachunków","Nie zaimportowano","Ostatni zatwierdzony wyciąg"],["Rachunek bieżący","Brak danych","Saldo nie jest jeszcze dostępne"],["Rachunek VAT","Brak danych","Środki VAT pokazywane oddzielnie"]].map(([title,value,detail])=>
      <div key={title} className="rounded-2xl border border-white/10 bg-[#111c35] p-5">
       <Wallet size={20} className="text-violet-300"/>
       <h2 className="mt-4 text-sm text-slate-300">{title}</h2>
       <p className="mt-2 text-xl font-bold">{value}</p>
       <p className="mt-2 text-xs text-slate-400">{detail}</p>
      </div>)}
    </section>
    <section className="mt-5 rounded-2xl border border-white/10 bg-[#111c35] p-5 sm:p-7">
     <div className="flex items-center gap-3"><Landmark className="text-violet-300"/><h2 className="text-xl font-bold">Wyciągi bankowe</h2></div>
     <div className="mt-5 rounded-xl border border-dashed border-white/20 p-6">
      <FileUp size={25} className="text-slate-400"/>
      <p className="mt-3 font-semibold">Miejsce na import PDF / CSV / XLSX</p>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">Import do bazy jest w przygotowaniu. Przycisk przesyłania będzie dostępny po uruchomieniu walidacji i zapisu wyciągów. Do tego czasu nie wyświetlamy sald jako aktualnych ani nie oznaczamy faktur jako zapłaconych.</p>
     </div>
    </section>
    <section className="mt-5 rounded-2xl border border-white/10 bg-[#111c35] p-5">
     <h2 className="text-lg font-bold">Rozliczenia z KSeF</h2>
     <p className="mt-2 text-sm text-slate-400">Po imporcie będą tu operacje, propozycje dopasowań i płatności częściowe. Niejednoznaczne dopasowania będą wymagały zatwierdzenia.</p>
    </section>
   </>}
  </div>
 </main>;
}
