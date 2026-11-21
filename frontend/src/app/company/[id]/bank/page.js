"use client";
import Link from "next/link";
import {useParams} from "next/navigation";
import {useEffect,useState} from "react";
import {ArrowLeft,Landmark,FileUp,FileDown,ShieldAlert,Wallet,CheckCircle2,
 AlertTriangle,RefreshCw,FileText} from "lucide-react";
import Navbar from "../../../components/Navbar";
import UserMenu from "../../../components/UserMenu";
import {
 getOrganizationFinanceStatus,getOrganizationWorkspace,
 getOrganizationBankSummary,getOrganizationBankStatements,
 getOrganizationBankFiles,uploadOrganizationBankFile,downloadOrganizationBankFile
} from "@/lib/api";

const MAX_FILES=12;
const MAX_PDF=15*1024*1024;
const MAX_CSV=2*1024*1024;
const formatMoney=(amount,currency="PLN")=>{
 if(amount==null)return "Saldo nieustalone";
 const value=Number(amount);
 if(!Number.isFinite(value))return "Saldo nieustalone";
 try{return new Intl.NumberFormat("pl-PL",{style:"currency",currency}).format(value);}
 catch{return String(amount)+" "+currency;}
};
const fileSize=size=>size>=1024*1024?
 (size/(1024*1024)).toLocaleString("pl-PL",{maximumFractionDigits:1})+" MB":
 Math.max(1,Math.round(size/1024))+" KB";
const statusText={
 IMPORTED:"Transakcje zaimportowane",
 REVIEW_REQUIRED:"Zapisany — do weryfikacji",
 PROCESSING:"Przetwarzanie"
};
export default function CompanyBankPage(){
 const {id}=useParams();
 const [name,setName]=useState("");
 const [owner,setOwner]=useState(false);
 const [canView,setCanView]=useState(false);
 const [loading,setLoading]=useState(true);
 const [uploading,setUploading]=useState(false);
 const [progress,setProgress]=useState("");
 const [notice,setNotice]=useState("");
 const [error,setError]=useState("");
 const [files,setFiles]=useState([]);
 const [accounts,setAccounts]=useState([]);
 const [statements,setStatements]=useState([]);
 const [downloading,setDownloading]=useState("");

 async function refresh(){
  const [f,accountsResult,history]=await Promise.allSettled([
   getOrganizationBankFiles(id),getOrganizationBankSummary(id),getOrganizationBankStatements(id)
  ]);
  if(f.status==="fulfilled")setFiles(Array.isArray(f.value?.items)?f.value.items:[]);
  if(accountsResult.status==="fulfilled")setAccounts(accountsResult.value?.data?.accounts||[]);
  if(history.status==="fulfilled")setStatements(history.value?.data||[]);
  if(f.status==="rejected")throw f.reason;
 }

 useEffect(()=>{
  if(!id)return;
  let active=true;
  setLoading(true);setError("");setFiles([]);setAccounts([]);setStatements([]);
  (async()=>{
   const [workspaceResult,financeResult]=await Promise.allSettled([
    getOrganizationWorkspace(id),getOrganizationFinanceStatus(id)
   ]);
   if(!active)return;
   const company=workspaceResult.status==="fulfilled"?workspaceResult.value?.data?.company:null;
   if(!company?.id||company.id!==id)throw Error("Nie udało się potwierdzić wybranej spółki.");
   const isOwner=company.role==="OWNER";
   const canSee=Boolean(isOwner||
    (financeResult.status==="fulfilled"&&financeResult.value?.data?.canView));
   setName(company.displayName||company.name);
   setOwner(isOwner);
   setCanView(canSee);
   if(!canSee)return;
   const [f,accountsResult,history]=await Promise.allSettled([
    isOwner?getOrganizationBankFiles(id):Promise.resolve({items:[]}),
    getOrganizationBankSummary(id),getOrganizationBankStatements(id)
   ]);
   if(!active)return;
   if(f.status==="fulfilled")setFiles(Array.isArray(f.value?.items)?f.value.items:[]);
   if(accountsResult.status==="fulfilled")setAccounts(accountsResult.value?.data?.accounts||[]);
   if(history.status==="fulfilled")setStatements(history.value?.data||[]);
   if(f.status==="rejected")setError(f.reason?.message||"Nie udało się pobrać listy wyciągów.");
   else if(accountsResult.status==="rejected"||history.status==="rejected")
    setError("Część danych bankowych jest niedostępna. Możesz nadal przesłać wyciąg.");
  })().catch(err=>{if(active)setError(err?.message||"Nie udało się otworzyć banku.");})
   .finally(()=>{if(active)setLoading(false);});
  return()=>{active=false;};
 },[id]);

 async function pickFiles(event){
  const selected=Array.from(event.target.files||[]);
  event.target.value="";
  if(!selected.length||uploading)return;
  if(selected.length>MAX_FILES){
   setError("Wybierz maksymalnie 12 plików jednocześnie.");return;
  }
  for(const file of selected){
   const pdf=/\.pdf$/i.test(file.name),csv=/\.csv$/i.test(file.name);
   if(!pdf&&!csv){setError("Obsługujemy wyciągi CSV lub PDF: "+file.name);return;}
   if(file.size<1||file.size>(pdf?MAX_PDF:MAX_CSV)){
    setError("Plik "+file.name+" jest pusty lub zbyt duży.");return;
   }
  }
  setUploading(true);setError("");setNotice("");
  let imported=0,saved=0,already=0;
  const failures=[];
  try{
   for(let index=0;index<selected.length;index++){
    const file=selected[index];
    setProgress("Wczytuję "+(index+1)+"/"+selected.length+": "+file.name);
    try{
     const result=await uploadOrganizationBankFile(id,file);
     if(!result?.item?.id)throw Error("Brak potwierdzenia zapisu.");
     if(result.alreadySaved)already++;
     else if(result.item.status==="IMPORTED")imported++;
     else saved++;
     setFiles(prev=>[result.item,...prev.filter(item=>item.id!==result.item.id)]);
    }catch(err){failures.push(file.name+": "+(err?.message||"Błąd serwera"));}
   }
   setNotice((imported?"Zaimportowano transakcje z "+imported+" plików. ":"")+
    (saved?"Zapisano "+saved+" plików do dalszej weryfikacji. ":"")+
    (already?"Pomijam "+already+" wcześniej przesłanych plików.":""));
   if(failures.length)setError("Nie udało się zapisać: "+failures.join(" | "));
   try{await refresh();}
   catch(err){setError(old=>old||err.message);}
  }finally{
   setProgress("");setUploading(false);
  }
 }
 async function download(item){
  if(downloading)return;
  setDownloading(item.id);setError("");
  try{
   const file=await downloadOrganizationBankFile(id,item.id);
   const url=URL.createObjectURL(file);
   const anchor=document.createElement("a");
   anchor.href=url;anchor.download=item.name;
   document.body.appendChild(anchor);anchor.click();anchor.remove();
   setTimeout(()=>URL.revokeObjectURL(url),1000);
  }catch(err){setError(err?.message||"Nie udało się pobrać pliku.");}
  finally{setDownloading("");}
 }
 return <main className="min-h-screen min-w-0 overflow-x-clip bg-[#080e20] px-3 py-5 pb-24 text-slate-100 sm:px-6">
  <div className="mx-auto max-w-7xl">
   <header className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-[#111c35] p-4">
    <Link href={"/company/"+encodeURIComponent(id)+"/finance"} className="inline-flex min-h-11 items-center gap-2 text-sm text-violet-200">
     <ArrowLeft size={18}/> Finanse spółki
    </Link><UserMenu/>
   </header>
   <Navbar/>
   <div className="mt-5 rounded-2xl border border-violet-400/20 bg-gradient-to-r from-[#1c1843] to-[#123451] p-5 sm:p-7">
    <p className="text-xs font-bold uppercase tracking-widest text-violet-200">Spółka / Bank</p>
    <h1 className="mt-2 text-2xl font-black sm:text-3xl">Wyciągi bankowe — {name||"wybrana spółka"}</h1>
    <p className="mt-3 text-sm text-slate-200">Wczytaj wyciąg. PrzemAI zapisze plik, odczyta dane i automatycznie zaimportuje rozpoznane operacje, jeżeli w pliku można ustalić rachunek i walutę.</p>
   </div>
   {loading&&<p className="mt-5 text-sm text-slate-300">Sprawdzam dostęp do banku…</p>}
   {error&&<p role="alert" className="mt-5 whitespace-pre-wrap break-words rounded-xl border border-rose-400/30 bg-rose-500/10 p-4 text-sm text-rose-200">{error}</p>}
   {notice&&<p role="status" className="mt-5 rounded-xl border border-emerald-400/30 bg-emerald-500/10 p-4 text-sm text-emerald-200">{notice}</p>}
   {!loading&&!canView&&<section className="mt-5 rounded-xl border border-amber-400/30 bg-[#111c35] p-5">
    <ShieldAlert size={20} className="text-amber-200"/>
    <h2 className="mt-3 font-bold">Brak dostępu do finansów tej spółki</h2>
    <p className="mt-2 text-sm text-slate-300">Dostęp wymaga uprawnienia finansowego lub roli właściciela.</p>
   </section>}
   {!loading&&canView&&<>
    <Link href={"/company/"+encodeURIComponent(id)+"/bank/reports"}
     className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-cyan-400/30 bg-gradient-to-r from-[#113348] to-[#1c2a50] p-5 hover:border-cyan-300/70">
     <span>
      <strong className="block text-lg">Zestawienia bankowe — saldo bieżące i VAT</strong>
      <span className="mt-1 block text-sm text-slate-300">Stany na koniec miesiąca · wpływy · wydatki · porównanie miesięcy</span>
     </span>
     <FileText size={24} className="shrink-0 text-cyan-200"/>
    </Link>
    {owner?<section className="mt-5 rounded-2xl border border-white/10 bg-[#111c35] p-5 sm:p-7">
     <h2 className="flex items-center gap-2 text-xl font-bold"><Landmark size={21} className="text-violet-300"/> Dodaj wyciągi</h2>
     <p className="mt-3 text-sm leading-6 text-slate-300">Nie wpisujesz ręcznie rachunku, okresu, numeru wyciągu ani sald. Wybierz jeden lub kilka plików — przesyłanie rozpocznie się automatycznie.</p>
     <label htmlFor="bank-file-auto" className="mt-5 block cursor-pointer rounded-2xl border-2 border-dashed border-violet-400/40 bg-violet-500/[.055] p-6 text-center hover:border-violet-300">
      <FileUp size={36} className="mx-auto text-violet-300"/>
      <strong className="mt-3 block text-base">Wybierz wyciąg CSV lub PDF</strong>
      <span className="mt-2 block text-xs text-slate-300">Możesz wybrać do 12 plików naraz · CSV do 2 MB · PDF do 15 MB</span>
      <span className="mt-4 inline-flex min-h-11 items-center rounded-xl bg-violet-500 px-5 text-sm font-bold text-white">
       {uploading?"Wczytywanie…":"Wybierz pliki z urządzenia"}
      </span>
      <input id="bank-file-auto" type="file" multiple disabled={uploading}
       accept=".csv,.pdf,text/csv,application/pdf" onChange={pickFiles}
       className="sr-only"/>
     </label>
     {progress&&<p role="status" className="mt-3 flex items-center gap-2 text-sm text-cyan-200">
      <RefreshCw size={16} className="animate-spin"/>{progress}</p>}
     <p className="mt-4 text-xs leading-5 text-slate-400">
      Jeśli wyciąg nie podaje jednoznacznie rachunku lub PDF ma nieobsługiwany układ, oryginał będzie zapisany ze statusem „Do weryfikacji”, bez tworzenia niepewnych transakcji. Nie oznaczamy automatycznie faktur KSeF jako opłaconych.
     </p>
    </section>:<p className="mt-5 rounded-xl border border-white/10 bg-[#111c35] p-4 text-sm text-slate-300">Wyciągi do systemu dodaje właściciel spółki.</p>}
    {accounts.length>0&&<section className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
     {accounts.map(account=><article key={account.id} className="rounded-2xl border border-white/10 bg-[#111c35] p-5">
      <Wallet size={18} className="text-violet-300"/>
      <h3 className="mt-2 text-sm text-slate-200">{account.label||"Rachunek bankowy"} · •••• {account.ibanSuffix}</h3>
      <strong className="mt-2 block text-xl">{formatMoney(account.balance,account.currency)}</strong>
      <p className="mt-2 text-xs text-slate-400">{account.balanceDate?
       "Saldo wyciągu z "+new Date(account.balanceDate).toLocaleDateString("pl-PL"):
       "W pliku nie podano potwierdzonego salda."}</p>
     </article>)}
    </section>}
    {owner&&<section className="mt-5 rounded-2xl border border-white/10 bg-[#111c35] p-4 sm:p-6">
     <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 className="text-lg font-bold">Przesłane pliki — {name}</h2>
      <button type="button" onClick={()=>refresh().catch(err=>setError(err?.message||"Błąd odświeżania"))} disabled={uploading}
       className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/15 px-4 text-xs font-semibold disabled:opacity-50">
       <RefreshCw size={15}/> Odśwież
      </button>
     </div>
     {files.length===0?<p className="mt-4 text-sm text-slate-400">Nie przesłano jeszcze wyciągów do tej spółki.</p>:
      <div className="mt-4 space-y-3">{files.map(item=><article key={item.id}
       className="flex min-w-0 flex-wrap items-start gap-3 rounded-xl border border-white/10 bg-white/[.035] p-4">
        <FileText size={20} className="mt-1 shrink-0 text-violet-200"/>
        <div className="min-w-0 flex-1">
         <p className="break-all text-sm font-bold">{item.name}</p>
         <p className="mt-1 text-xs text-slate-400">{fileSize(item.size)} · {new Date(item.uploadedAt).toLocaleString("pl-PL")} · Spółka: {name}</p>
         <p className={"mt-2 flex items-center gap-1.5 text-xs font-semibold "+
          (item.status==="IMPORTED"?"text-emerald-300":"text-amber-200")}>
          {item.status==="IMPORTED"?<CheckCircle2 size={15}/>:<AlertTriangle size={15}/>}
          {statusText[item.status]||"Zapisano"}
          {item.transactionCount>0?" · "+item.transactionCount+" operacji":""}
         </p>
         {item.note&&<p className="mt-2 text-xs leading-5 text-slate-300">{item.note}</p>}
        </div>
        <button type="button" disabled={Boolean(downloading)} onClick={()=>download(item)}
         className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/15 px-3 text-xs disabled:opacity-50">
         <FileDown size={16}/>{downloading===item.id?"Pobieranie…":"Pobierz"}
        </button>
       </article>)}</div>}
    </section>}
    <section className="mt-5 rounded-2xl border border-white/10 bg-[#111c35] p-4 sm:p-6">
     <h2 className="text-lg font-bold">Zaimportowane operacje bankowe</h2>
     {statements.length===0?<p className="mt-3 text-sm text-slate-400">Nie ma jeszcze zweryfikowanych operacji. Przesłane pliki do weryfikacji są widoczne powyżej.</p>:
      <div className="mt-3 space-y-2">{statements.map(item=><article key={item.id} className="rounded-xl border border-white/10 p-3 text-sm">
       <strong>{item.statementNumber?.startsWith("CSV_IMPORT_")?"Import z CSV":item.statementNumber}</strong>
       <span className="text-slate-400"> · rachunek •••• {item.bankAccount?.ibanSuffix} · {item.transactionCount} operacji</span>
       <p className="mt-1 text-xs text-slate-400">Data ostatniej operacji / koniec okresu: {item.periodEnd?new Date(item.periodEnd).toLocaleDateString("pl-PL"):"—"} · {formatMoney(item.closingBalance)}</p>
      </article>)}</div>}
    </section>
   </>}
  </div>
 </main>;
}
