"use client";
import {useEffect,useMemo,useState} from "react";
import Link from "next/link";
import {useParams} from "next/navigation";
import {ArrowLeft,FileText,Landmark,ShieldCheck,RefreshCw,AlertTriangle} from "lucide-react";
import Navbar from "../../../../components/Navbar";
import UserMenu from "../../../../components/UserMenu";
import {getOrganizationBankKsefMatches,getOrganization,getOrganizationSettlements,
 changeOrganizationSettlement,getOrganizationFinanceStatus} from "@/lib/api";
const money=(value,currency)=>{
 if(value==null)return "—";
 const n=Number(value);
 if(!Number.isFinite(n))return "—";
 try{return new Intl.NumberFormat("pl-PL",{style:"currency",currency}).format(n);}
 catch{return String(value)+" "+currency;}
};
const xmlReason={SIZE:"plik przekracza limit",EMPTY:"pusta odpowiedź",FORMAT:"niepoprawny format",
 ENCODING:"niepoprawne kodowanie",UNCLASSIFIED:"brak szczegółów błędu"};
const kind={INCOMING:"Zakup / płatność wychodząca",OUTGOING:"Sprzedaż / wpływ"};
function Candidate({item,onConfirm}) {
 return <article className="rounded-xl border border-white/10 bg-white/[.035] p-4">
  <div className="flex flex-wrap items-start justify-between gap-2">
   <div className="min-w-0">
    <p className="text-sm font-bold">{item.invoiceNumber||"Faktura bez numeru"}</p>
    <p className="mt-1 text-xs text-slate-300">{kind[item.direction]} · {item.contractor||"Kontrahent"} · {item.invoiceDate}</p>
   </div>
   <p className="text-lg font-bold tabular-nums">{money(item.grossAmount,item.currency)}</p>
  </div>
  <div className="mt-3 rounded-lg border border-cyan-400/15 bg-cyan-500/5 p-3 text-sm">
   <p>Operacja z dnia <strong>{item.bookedAt}</strong> · rachunek •••• {item.accountSuffix}</p>
   <p className="mt-1 break-words text-xs text-slate-300">{item.description||"Brak opisu przelewu"}</p>
   <p className="mt-2 font-semibold">{money(item.transactionAmount,item.currency)}{item.accountType==="VAT"?" · VAT":""}</p>
  </div>
  <p className="mt-2 text-xs text-amber-200">
   {["VAT_REFERENCE","PARTIAL_REFERENCE"].includes(item.reason)?"Wpłata częściowa lub operacja VAT z numerem faktury. Sprawdź dokument przed potwierdzeniem.":
   item.confidence==="AMBIGUOUS"?
    "Kilka możliwych dopasowań — wymaga ręcznej analizy.":
    item.confidence==="STRONG"?
    "Zgodny numer faktury, kwota i okres — sprawdź przed potwierdzeniem.":
    "Zgodna kwota, okres i kontrahent — możliwe dopasowanie do sprawdzenia."}
  </p>
  {onConfirm&&(Number(item.grossAmount)>0||item.refundInvoiceId)&&<button type="button" className="mt-3 rounded-lg bg-violet-700 px-3 py-2 text-sm"
   onClick={()=>onConfirm(item)}>{item.refundInvoiceId?"Potwierdź zwrot":"Potwierdź operację"}</button>}
 </article>;
}
export default function BankKsefMatchesPage(){
 const {id}=useParams();
 const [year,setYear]=useState(new Date().getFullYear());
 const [draft,setDraft]=useState(String(new Date().getFullYear()));
 const [company,setCompany]=useState("");
 const [report,setReport]=useState(null);
 const [settlements,setSettlements]=useState(null);
 const [canManage,setCanManage]=useState(false);
 const [busy,setBusy]=useState(false);
 const [actionError,setActionError]=useState("");
 const [filter,setFilter]=useState("");
 const [offset,setOffset]=useState(0);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState("");
 const [refresh,setRefresh]=useState(0);
 const summary=useMemo(()=>report?.totals||null,[report]);
 useEffect(()=>{
  if(!id)return;
  let active=true;
  setLoading(true);setError("");setReport(null);
  Promise.all([getOrganization(id),getOrganizationBankKsefMatches(id,year),
   getOrganizationSettlements(id,year),getOrganizationFinanceStatus(id)]).then(([org,result,settled,status])=>{
   if(!active)return;
   if(org?.data?.id!==id||result?.data?.organizationId!==id||
    result?.data?.year!==year||result?.data?.source!=="KSEF_BANK_SUGGESTIONS")
    throw Error("Nie potwierdzono zakresu danych spółki.");
   setCompany(org.data.displayName||org.data.name||"");
   setReport(result.data);
   setSettlements(settled.data);
   setCanManage(Boolean(status.data?.canManage));
  }).catch(err=>{if(active)setError(err?.message||"Nie można przygotować rozliczeń.");})
   .finally(()=>{if(active)setLoading(false);});
  return()=>{active=false;};
 },[id,year,refresh]);
 function chooseYear(event){
  event.preventDefault();
  const next=Number(draft);
  if(!Number.isInteger(next)||next<2020||next>2100){
   setError("Podaj poprawny rok od 2020 do 2100.");return;
  }
  setYear(next);setOffset(0);setRefresh(x=>x+1);
 }
 async function change(documentId,kind,data){
  if(busy)return;
  setBusy(true);setActionError("");
  try{await changeOrganizationSettlement(id,documentId,kind,data);setRefresh(n=>n+1);}
  catch(error){setActionError(error.message);}
  finally{setBusy(false);}
 }
 function confirm(item){
  if(window.confirm("Czy zweryfikowano operację "+money(item.transactionAmount,item.currency)+
    " dla faktury "+item.invoiceNumber+"?"))
   change(item.refundInvoiceId||item.invoiceId,"payments",{transactionId:item.transactionId});
 }
 const statuses={PAID:"Zapłacona",UNPAID:"Niezapłacona",PARTIAL:"Częściowo zapłacona",
  OVERDUE:"Przeterminowana",CLEARED:"Brak kwoty do zapłaty",UNKNOWN:"Brak kwoty",CORRECTION_REVIEW:"Korekta do powiązania",
  CORRECTION_APPLIED:"Korekta powiązana"};
 const rows=(settlements?.items||[]).filter(row=>!filter||
  (filter==="OVERDUE"?row.overdue:row.status===filter));
 const corrections=(settlements?.items||[]).filter(row=>row.status==="CORRECTION_REVIEW");
 return <main className="min-h-screen min-w-0 overflow-x-clip bg-[#080e20] px-3 py-5 pb-24 text-slate-100 sm:px-6">
  <div className="mx-auto max-w-6xl">
   <header className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-[#111c35] p-4">
    <Link href={"/company/"+encodeURIComponent(id)+"/finance"} className="inline-flex min-h-11 items-center gap-2 text-sm text-violet-200">
     <ArrowLeft size={18}/> Finanse spółki
    </Link><UserMenu/>
   </header>
   <Navbar/>
   <section className="mt-5 rounded-2xl border border-cyan-400/25 bg-gradient-to-r from-[#163a4e] to-[#241c46] p-5 sm:p-7">
    <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-cyan-200"><Landmark size={16}/> Bank + KSeF</p>
    <h1 className="mt-3 text-2xl font-black sm:text-3xl">Możliwe rozliczenia faktur — {company||"spółka"}</h1>
    <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-200">
     System porównuje rzeczywiście pobrane faktury i transakcje tej spółki.
     Pokazuje zgodność kwoty, okresu i numeru faktury lub kontrahenta.
     Status faktury wynika z operacji zweryfikowanych przez właściciela.
    </p>
   </section>
   <form onSubmit={chooseYear} className="mt-5 flex flex-wrap items-end gap-3 rounded-2xl border border-white/10 bg-[#111c35] p-4">
    <label className="text-sm font-semibold">Rok faktur
     <input type="number" min="2020" max="2100" step="1" value={draft}
      onChange={e=>setDraft(e.target.value)}
      className="mt-2 block min-h-11 w-32 rounded-xl border border-white/15 bg-[#0b1730] px-3"/>
    </label>
    <button type="submit" disabled={loading} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-violet-600 px-4 text-sm font-bold text-white disabled:opacity-50">
     <RefreshCw size={17}/> Porównaj
    </button>
   </form>
   {loading&&<p role="status" className="mt-5 text-sm text-slate-300">Porównuję faktury z operacjami bankowymi…</p>}
   {error&&<p role="alert" className="mt-5 rounded-xl border border-rose-400/30 bg-rose-500/10 p-4 text-sm text-rose-200">{error}</p>}
   {actionError&&<p role="alert" className="mt-5 text-rose-200">{actionError}</p>}
   {!loading&&!error&&report&&<>
    {settlements&&<section className="mt-5 rounded-2xl border border-white/10 bg-[#111c35] p-5">
     <h2 className="text-lg font-bold">Rozliczenia na {settlements.asOf}</h2>
     <p className="mt-2 text-sm text-slate-300">Należności i zobowiązania obejmują otwarte faktury z poprzednich lat. Prognoza zakłada rozliczenie pełnych kwot wymagalnych do końca bieżącego miesiąca z rachunków bieżących. Środki na rachunkach VAT pokazujemy osobno.</p>
     {settlements.balances.map(row=><p key={row.currency} className="mt-2 text-sm">
      Należności {money(row.receivable,row.currency)} · Zobowiązania {money(row.payable,row.currency)} · Koszty stałe w {year} {money(row.fixedCosts,row.currency)}
     </p>)}
     {settlements.forecast.map(row=><p key={row.currency} className="mt-2 text-sm">
      Prognoza środków bieżących {row.currency} · {row.projectedMonthEnd===null?"Brak pełnych sald rachunków bieżących":money(row.projectedMonthEnd,row.currency)}
      {row.vatBalanceFromImports!=null&&" · Saldo VAT "+money(row.vatBalanceFromImports,row.currency)}
      {row.operatingClosings?.length>0&&" · daty sald rachunków bieżących "+[...new Set(row.operatingClosings)].join(", ")}
     </p>)}
     {Object.keys(settlements.diagnostics).length>0&&<p className="mt-2 text-sm text-amber-200">
      Nieprawidłowy XML KSeF · {Object.entries(settlements.diagnostics).map(([reason,count])=>xmlReason[reason]+" ("+count+")").join(", ")}
     </p>}
     <label className="mt-4 block text-sm">Status
      <select value={filter} onChange={event=>{setFilter(event.target.value);setOffset(0);}}
       className="ml-3 rounded-lg bg-[#0b1730] p-2">
       <option value="">Wszystkie</option>
       {Object.entries(statuses).map(([key,label])=><option key={key} value={key}>{label}</option>)}
      </select>
     </label>
     <div className="mt-4 divide-y divide-white/10">
      {rows.slice(offset,offset+30).map(row=><article key={row.id} className="py-3 text-sm">
       <p><strong>{row.invoiceNumber||"Faktura bez numeru"}</strong> · {statuses[row.status]}{row.overdue&&row.status==="PARTIAL"?" · po terminie":""}</p>
       <p className="text-slate-300">Do zapłaty {money(row.outstanding,row.currency)} · Potwierdzone {money(row.paid,row.currency)}
        {Number(row.overpayment)>0?" · Nadpłata "+money(row.overpayment,row.currency):""}</p>
       {row.invalidXml&&<p className="mt-1 text-amber-200">XML KSeF · {xmlReason[row.invalidXml.reason]}
        {row.invalidXml.attempts!==null?" · próby "+row.invalidXml.attempts:""}
        {row.invalidXml.nextRetryAt?" · następna próba od "+new Date(row.invalidXml.nextRetryAt)
         .toLocaleString("pl-PL",{timeZone:"Europe/Warsaw"}):""}
       </p>}
       {row.payments.map(payment=><p key={payment.transactionId} className="mt-1">
        {payment.bookedAt} · {payment.accountType==="VAT"?"VAT · ":""}{money(payment.amount,row.currency)}
        {canManage&&<button type="button" disabled={busy} className="ml-2 underline"
         onClick={()=>{if(window.confirm("Cofnąć powiązanie operacji z fakturą?"))change(payment.transactionId,"undo");}}>Cofnij potwierdzenie</button>}
       </p>)}
       {canManage&&row.status==="CORRECTION_APPLIED"&&<button type="button" disabled={busy}
        className="mt-2 underline" onClick={()=>{if(window.confirm("Cofnąć powiązanie korekty?"))change(row.id,"undoCorrection");}}>
        Cofnij powiązanie korekty
       </button>}
       {canManage&&corrections.length>0&&!row.status.startsWith("CORRECTION_")&&
        <label className="mt-2 block">Powiąż korektę
         <select disabled={busy} value="" className="ml-2 rounded bg-[#0b1730] p-1"
          onChange={event=>{const correctionId=event.target.value;
           if(correctionId&&window.confirm("Powiązać tę korektę z fakturą?"))change(row.id,"corrections",{correctionId});}}>
          <option value="">Wybierz fakturę korygującą</option>
          {corrections.filter(correction=>correction.direction===row.direction&&correction.currency===row.currency)
           .map(correction=><option key={correction.id} value={correction.id}>{correction.invoiceNumber||correction.id}</option>)}
         </select>
        </label>}
      </article>)}
     </div>
     {rows.length===0&&<p className="mt-3 text-sm text-slate-400">Brak faktur w wybranym zakresie.</p>}
     {offset>0&&<button className="mr-4 underline" onClick={()=>setOffset(n=>n-30)}>Wstecz</button>}
     {rows.length>offset+30&&<button className="underline" onClick={()=>setOffset(n=>n+30)}>Dalej</button>}
    </section>}
    <section className="mt-5 grid gap-3 sm:grid-cols-3">
     {[
      {name:"Faktury sprawdzone",count:summary?.invoicesExamined||0},
      {name:"Propozycje jednoznaczne",count:summary?.uniqueProposals||0},
      {name:"Niejednoznaczne",count:summary?.conflictingCandidates||0}
     ].map(item=><div key={item.name} className="rounded-xl border border-white/10 bg-[#111c35] p-4">
      <p className="text-xs text-slate-400">{item.name}</p><p className="mt-2 text-3xl font-black">{item.count}</p>
     </div>)}
    </section>
    <section className="mt-5 rounded-2xl border border-white/10 bg-[#111c35] p-4 sm:p-6">
     <h2 className="flex items-center gap-2 text-lg font-bold"><FileText size={19}/> Propozycje do sprawdzenia</h2>
     <p className="mt-2 text-xs text-slate-400">Dopasowania wyłącznie na podstawie danych w systemie. Nie oznaczają spłaty całego zobowiązania.</p>
     {report.proposed.length?
      <div className="mt-4 grid gap-3 md:grid-cols-2">{report.proposed.map(x=><Candidate key={x.invoiceId+"|"+x.transactionId} item={x} onConfirm={canManage&&!busy?confirm:undefined}/>)}</div>:
      <p className="mt-4 text-sm text-slate-400">Nie znaleziono jednoznacznych propozycji w wybranym roku. Nie oznacza to, że faktury są nieopłacone.</p>}
    </section>
    {report.conflicts.length>0&&<section className="mt-5 rounded-2xl border border-amber-400/25 bg-[#111c35] p-4 sm:p-6">
     <h2 className="flex items-center gap-2 text-lg font-bold"><AlertTriangle size={19} className="text-amber-300"/> Wymagają ręcznej analizy</h2>
     <div className="mt-4 grid gap-3 md:grid-cols-2">{report.conflicts.map(x=><Candidate key={x.invoiceId+"|"+x.transactionId} item={x} onConfirm={canManage&&!busy?confirm:undefined}/>)}</div>
    </section>}
   </>}
   <p className="mt-5 flex items-start gap-2 text-xs leading-5 text-slate-400"><ShieldCheck size={16} className="shrink-0"/>
    Przegląd jest dostępny wyłącznie po osobnym sprawdzeniu uprawnień bankowych i KSeF danej spółki.
    Płatności częściowe i VAT można potwierdzić po sprawdzeniu każdej operacji. Kompensaty wymagają odrębnej ewidencji.
   </p>
  </div>
 </main>;
}
