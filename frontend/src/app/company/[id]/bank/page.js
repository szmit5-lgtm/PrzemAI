"use client";
import Link from "next/link";
import {useParams} from "next/navigation";
import {useEffect,useState} from "react";
import {ArrowLeft,Landmark,FileUp,ShieldAlert,Wallet} from "lucide-react";
import Navbar from "../../../components/Navbar";
import UserMenu from "../../../components/UserMenu";
import {getOrganizationFinanceStatus,getOrganizationWorkspace,getOrganizationBankSummary,importOrganizationBankStatement,getOrganizationBankStatements} from "@/lib/api";

function parseCsv(text){
 const lines=[];let row=[],cell="",quoted=false;
 for(let i=0;i<text.length;i++){
  const ch=text[i];
  if(ch==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;}
  else if(ch===";"&&!quoted){row.push(cell.trim());cell="";}
  else if((ch==="\n"||ch==="\r")&&!quoted){if(ch==="\r"&&text[i+1]==="\n")i++;row.push(cell.trim());if(row.some(Boolean))lines.push(row);row=[];cell="";}
  else cell+=ch;
 }
 if(quoted)throw Error("Nieprawidłowe cudzysłowy w CSV.");
 row.push(cell.trim());if(row.some(Boolean))lines.push(row);
 const header=lines.shift()?.map(x=>x.toLowerCase().replace(/^\uFEFF/,""))||[];
 const required=["date","amount","description"];
 if(required.some(x=>!header.includes(x)))throw Error("CSV wymaga kolumn: date;amount;description (opcjonalnie counterparty;reference).");
 if(lines.length<1||lines.length>3000)throw Error("CSV musi zawierać od 1 do 3000 transakcji.");
 return lines.map((values,i)=>{
  const obj=Object.fromEntries(header.map((key,j)=>[key,values[j]||""]));
  if(!/^\d{4}-\d{2}-\d{2}$/.test(obj.date)||!obj.amount)throw Error("Nieprawidłowa data lub kwota w wierszu "+(i+2));
  return {date:obj.date,amount:obj.amount,description:obj.description,counterparty:obj.counterparty||"",reference:obj.reference||""};
 });
}
export default function CompanyBankPage(){
 const {id}=useParams();
 const [name,setName]=useState("");
 const [status,setStatus]=useState(null);
 const [error,setError]=useState("");
 const [accounts,setAccounts]=useState([]);
 const [loading,setLoading]=useState(true);
 const [owner,setOwner]=useState(false);
 const [statements,setStatements]=useState([]);
 const [transactions,setTransactions]=useState([]);
 const [iban,setIban]=useState("");
 const [statementNumber,setStatementNumber]=useState("");
 const [periodStart,setPeriodStart]=useState("");
 const [periodEnd,setPeriodEnd]=useState("");
 const [openingBalance,setOpeningBalance]=useState("");
 const [closingBalance,setClosingBalance]=useState("");
 const [importing,setImporting]=useState(false);
 const [notice,setNotice]=useState("");
 const [fileName,setFileName]=useState("");
 const [pdfPreview,setPdfPreview]=useState(null);
 const [pdfLoading,setPdfLoading]=useState(false);
 async function readFile(e){
  const file=e.target.files?.[0];e.target.value="";
  if(!file)return;
  setError("");setNotice("");setTransactions([]);setFileName("");setPdfPreview(null);
  if(/\.pdf$/i.test(file.name)){
   if(file.size>5*1024*1024){setError("PDF może mieć maksymalnie 5 MB.");return;}
   setPdfLoading(true);
   try{
    const form=new FormData();form.append("file",file);
    const token=localStorage.getItem("token");
    const response=await fetch("/api/organizations/"+encodeURIComponent(id)+"/bank/pdf-preview",{method:"POST",headers:{Authorization:"Bearer "+token},body:form});
    const result=await response.json();
    if(!response.ok||!result.success)throw Error(result.error||"Nie udało się odczytać PDF.");
    setPdfPreview(result.data);setFileName(file.name);
   }catch(err){setError(err.message);}finally{setPdfLoading(false);}
   return;
  }
  if(!/\.csv$/i.test(file.name)||file.size>1024*1024){setError("Wybierz plik CSV do 1 MB.");return;}
  try{const rows=parseCsv(await file.text());setTransactions(rows);setFileName(file.name);}
  catch(err){setError(err.message);}
 }
 async function submitImport(e){
  e.preventDefault();if(importing||!transactions.length)return;
  setImporting(true);setError("");setNotice("");
  try{
   const r=await importOrganizationBankStatement(id,{iban,statementNumber,periodStart,periodEnd,openingBalance,closingBalance,transactions});
   setNotice("Zaimportowano "+r.data.transactionCount+" transakcji. Salda zapisano na podstawie wyciągu.");
   setTransactions([]);setFileName("");
   const [history,summary]=await Promise.all([getOrganizationBankStatements(id),getOrganizationBankSummary(id)]);
   setStatements(history?.data||[]);setAccounts(summary?.data?.accounts||[]);
  }catch(err){setError(err.message||"Nie udało się zaimportować wyciągu.");}
  finally{setImporting(false);}
 }
 useEffect(()=>{
  if(!id)return;
  let alive=true;setLoading(true);setError("");
  Promise.all([getOrganizationWorkspace(id),getOrganizationFinanceStatus(id)])
   .then(([workspace,finance])=>{
    if(!alive)return;
    setName(workspace?.data?.company?.displayName||workspace?.data?.company?.name||"");
    setOwner(workspace?.data?.company?.role==="OWNER");
    setStatus(finance?.data||{});
    if(finance?.data?.canView)Promise.all([getOrganizationBankSummary(id),getOrganizationBankStatements(id)]).then(([v,h])=>{if(alive){setAccounts(v?.data?.accounts||[]);setStatements(h?.data||[]);}}).catch(e=>{if(alive)setError(e.message||"Nie udało się pobrać wyciągów.");});
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
     {accounts.length===0?<div className="rounded-2xl border border-white/10 bg-[#111c35] p-5 text-slate-300">Nie zaimportowano jeszcze żadnego wyciągu. Salda pojawią się po zatwierdzonym imporcie.</div>:
      accounts.map(a=><div key={a.id} className="rounded-2xl border border-white/10 bg-[#111c35] p-5">
       <Wallet size={20} className="text-violet-300"/>
       <h2 className="mt-4 text-sm text-slate-300">{a.label|| (a.accountType==="VAT"?"Rachunek VAT":"Rachunek bankowy")} · •••• {a.ibanSuffix}</h2>
       <p className="mt-2 text-xl font-bold">{a.balance===null?"Brak salda":new Intl.NumberFormat("pl-PL",{style:"currency",currency:a.currency||"PLN"}).format(Number(a.balance))}</p>
       <p className="mt-2 text-xs text-slate-400">{a.balanceDate?"Saldo z wyciągu na "+new Date(a.balanceDate).toLocaleDateString("pl-PL"):"Brak wyciągu"}</p>
      </div>)}
    </section>
    <section className="mt-5 rounded-2xl border border-white/10 bg-[#111c35] p-5 sm:p-7">
     <div className="flex items-center gap-3"><Landmark className="text-violet-300"/><h2 className="text-xl font-bold">Wyciągi bankowe</h2></div>
     <p className="mt-3 text-sm text-slate-400">Import CSV z kontrolą sald lub bezpieczny podgląd tekstu PDF przed weryfikacją. PDF nie jest jeszcze automatycznie zapisywany jako transakcje. Operacje nie oznaczają faktur KSeF jako opłaconych.</p>
     {owner?<form onSubmit={submitImport} className="mt-5 space-y-4">
      <label className="block rounded-xl border border-dashed border-violet-400/40 p-5 text-sm">
       <FileUp size={24} className="mb-3 text-violet-300"/>
       Wybierz wyciąg CSV (do 1 MB) lub PDF (do 5 MB)
       <input type="file" accept=".csv,.pdf,text/csv,application/pdf" onChange={readFile} className="mt-3 block w-full text-sm"/>
      </label>
      <p className="text-xs text-slate-400">Wymagane nagłówki CSV oddzielone średnikami: date;amount;description;counterparty;reference. Daty RRRR-MM-DD, kwoty ze znakiem minus dla wydatków.</p>
      {pdfLoading&&<p className="text-sm text-slate-300">Odczytywanie PDF…</p>}
      {pdfPreview&&<div className="rounded-xl border border-amber-400/30 p-4"><p className="text-sm text-amber-200">{pdfPreview.warning}</p><p className="mt-2 text-xs">Strony: {pdfPreview.pages}</p><pre className="mt-3 max-h-96 overflow-auto whitespace-pre-wrap text-xs">{pdfPreview.lines.join("\n")}</pre></div>}
      {fileName&&<p className="text-sm text-emerald-300">Wczytano {fileName}: {transactions.length ? transactions.length+" operacji do sprawdzenia" : "podgląd PDF bez zapisu transakcji"}.</p>}
      <div className="grid gap-3 sm:grid-cols-2">
       {[[iban,setIban,"IBAN rachunku"],[statementNumber,setStatementNumber,"Numer wyciągu"],[openingBalance,setOpeningBalance,"Saldo początkowe PLN"],[closingBalance,setClosingBalance,"Saldo końcowe PLN"]].map(([value,setValue,label])=><label key={label} className="text-sm">{label}
        <input required value={value} onChange={e=>setValue(e.target.value)} className="mt-1 w-full rounded-lg border border-white/20 bg-[#0a162d] p-3" placeholder={label}/>
       </label>)}
       <label className="text-sm">Początek okresu<input required type="date" value={periodStart} onChange={e=>setPeriodStart(e.target.value)} className="mt-1 w-full rounded-lg border border-white/20 bg-[#0a162d] p-3"/></label>
       <label className="text-sm">Koniec okresu<input required type="date" value={periodEnd} onChange={e=>setPeriodEnd(e.target.value)} className="mt-1 w-full rounded-lg border border-white/20 bg-[#0a162d] p-3"/></label>
      </div>
      <button type="submit" disabled={importing||transactions.length===0} className="min-h-12 rounded-xl bg-violet-600 px-6 font-semibold disabled:opacity-40">{importing?"Importowanie…":"Zatwierdź import "+transactions.length+" transakcji"}</button>
     </form>:<p className="mt-4 text-sm text-slate-400">Import może wykonać właściciel firmy.</p>}
     {notice&&<p role="status" className="mt-4 text-sm text-emerald-300">{notice}</p>}
     <h3 className="mt-7 font-bold">Zaimportowane wyciągi</h3>
     {statements.length===0?<p className="mt-2 text-sm text-slate-400">Brak wyciągów.</p>:<div className="mt-3 space-y-2">{statements.map(s=><div key={s.id} className="rounded-xl border border-white/10 p-3 text-sm">
      <strong>{s.statementNumber}</strong> · rachunek •••• {s.bankAccount?.ibanSuffix} · {s.transactionCount} operacji
      <p className="mt-1 text-xs text-slate-400">Saldo końcowe: {s.closingBalance} PLN · {new Date(s.periodEnd).toLocaleDateString("pl-PL")}</p>
     </div>)}</div>}
    </section>
    <section className="mt-5 rounded-2xl border border-white/10 bg-[#111c35] p-5">
     <h2 className="text-lg font-bold">Rozliczenia z KSeF</h2>
     <p className="mt-2 text-sm text-slate-400">Po imporcie będą tu operacje, propozycje dopasowań i płatności częściowe. Niejednoznaczne dopasowania będą wymagały zatwierdzenia.</p>
    </section>
   </>}
  </div>
 </main>;
}
