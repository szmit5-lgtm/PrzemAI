"use client";
import {useEffect,useState} from "react";
import Link from "next/link";
import {useParams} from "next/navigation";
import {ArrowLeft,Building2,CheckCircle2,Clock3,ExternalLink,
 Globe2,Plus,RefreshCw,ShieldCheck,Users,Wallet,Copy,Check,
 AlertTriangle,Palette,BriefcaseBusiness} from "lucide-react";
import Navbar from "../../components/Navbar";
import UserMenu from "../../components/UserMenu";
import {
 getOrganizationWorkspace,createOrganizationTask,changeOrganizationTaskStatus,
 getOrganizationMembers,inviteOrganizationMember,revokeOrganizationMember,
 updateOrganizationBrand,requestOrganizationDomain,getOrganizationDomainInstructions,
 verifyOrganizationDomain
} from "@/lib/api";
const statuses={TODO:"Do zrobienia",IN_PROGRESS:"W trakcie",DONE:"Zakończone"};
const roles={OWNER:"Właściciel",ADMIN:"Administrator",MEMBER:"Pracownik"};
const tabs=[["tasks","Zadania firmowe"],["team","Zespół"],["brand","Wygląd i logo"],["domain","Domena"]];
const date=value=>{
 if(!value)return "—";
 const d=new Date(value);
 return Number.isNaN(d.getTime())?"—":d.toLocaleDateString("pl-PL");
};
export default function CompanyWorkspace(){
 const {id}=useParams();
 const [data,setData]=useState(null);
 const [members,setMembers]=useState([]);
 const [tab,setTab]=useState("tasks");
 const [loading,setLoading]=useState(true);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");
 const [notice,setNotice]=useState("");
 const [refresh,setRefresh]=useState(0);
 const [title,setTitle]=useState("");
 const [description,setDescription]=useState("");
 const [dueDate,setDueDate]=useState("");
 const [priority,setPriority]=useState("MEDIUM");
 const [displayName,setDisplayName]=useState("");
 const [logoUrl,setLogoUrl]=useState("");
 const [accentColor,setAccentColor]=useState("#8b5cf6");
 const [memberEmail,setMemberEmail]=useState("");
 const [memberRole,setMemberRole]=useState("MEMBER");
 const [hostname,setHostname]=useState("");
 const [dnsRecord,setDnsRecord]=useState(null);
 const [dnsBusy,setDnsBusy]=useState("");
 const org=data?.company;
 const tasks=data?.tasks||[];
 const isAdmin=["OWNER","ADMIN"].includes(org?.role);
 const isOwner=org?.role==="OWNER";
 useEffect(()=>{
  if(!id)return;
  let active=true;setLoading(true);setError("");
  getOrganizationWorkspace(id).then(async r=>{
   if(!active)return;
   if(!r?.data?.company)throw Error("Brak danych firmy.");
   setData(r.data);
   const company=r.data.company;
   setDisplayName(company.displayName||company.name);
   setLogoUrl(company.logoUrl||"");
   setAccentColor(company.accentColor||"#8b5cf6");
   localStorage.setItem("przemai-active-organization",id);
   if(["OWNER","ADMIN"].includes(company.role)){
    try{
     const result=await getOrganizationMembers(id);
     if(active)setMembers(Array.isArray(result?.data)?result.data:[]);
    }catch{/* Membership visibility is optional for members. */}
   }
  }).catch(e=>{if(active)setError(e.message||"Nie udało się otworzyć firmy.");})
   .finally(()=>{if(active)setLoading(false);});
  return()=>{active=false;};
 },[id,refresh]);

 async function mutate(fn,message){
  if(busy)return;
  setBusy(true);setError("");setNotice("");
  try{await fn();setNotice(message);setRefresh(n=>n+1);}
  catch(e){setError(e.message||"Nie udało się wykonać operacji.");}
  finally{setBusy(false);}
 }
 function submitTask(e){
  e.preventDefault();
  mutate(async()=>{
   await createOrganizationTask(id,{title,description,priority,dueDate});
   setTitle("");setDescription("");setDueDate("");setPriority("MEDIUM");
  },"Zadanie zostało dodane do tej firmy.");
 }
 function saveBrand(e){
  e.preventDefault();
  mutate(()=>updateOrganizationBrand(id,{displayName,logoUrl,accentColor}),
    "Wygląd i nazwa firmy zostały zapisane.");
 }
 function invite(e){
  e.preventDefault();
  mutate(async()=>{
   await inviteOrganizationMember(id,{email:memberEmail.trim(),role:memberRole});
   setMemberEmail("");
  },"Wysłano zaproszenie w systemie. Osoba zobaczy je po zalogowaniu do swojego konta PrzemAI.");
 }
 function requestDomain(e){
  e.preventDefault();
  mutate(async()=>{
   const result=await requestOrganizationDomain(id,hostname.trim());
   setDnsRecord(result.data);
   setHostname("");
  },"Domena została zgłoszona. Dodaj rekord TXT i wykonaj weryfikację.");
 }
 async function showDNS(domain){
  setDnsBusy(domain.id);setError("");
  try{
   const r=await getOrganizationDomainInstructions(id,domain.id);
   setDnsRecord(r.data);
  }catch(e){setError(e.message||"Nie można pobrać instrukcji DNS.");}
  finally{setDnsBusy("");}
 }
 async function verifyDNS(domain){
  setDnsBusy(domain.id);setError("");setNotice("");
  try{
   await verifyOrganizationDomain(id,domain.id);
   setNotice("Potwierdzono własność domeny. Pozostaje konfiguracja domeny na hostingu i certyfikatu SSL.");
   setRefresh(n=>n+1);
  }catch(e){setError(e.message||"Rekord TXT nie został znaleziony.");}
  finally{setDnsBusy("");}
 }

 return <main className="min-h-screen min-w-0 overflow-x-clip bg-[#080e20] px-3 py-5 text-slate-100 sm:px-6 lg:px-8">
  <div className="mx-auto w-full max-w-7xl min-w-0">
   <header className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-[#111c35] p-4">
    <Link href="/company/setup" className="inline-flex items-center gap-2 text-sm font-bold text-violet-200"><ArrowLeft size={18}/> Wszystkie firmy</Link><UserMenu/>
   </header>
   <Navbar/>
   {loading&&<p className="mt-7 text-sm text-slate-400">Otwieram przestrzeń firmy…</p>}
   {error&&<p role="alert" className="mt-5 rounded-xl border border-rose-400/30 bg-rose-400/10 p-4 text-sm text-rose-200">{error}</p>}
   {notice&&<p role="status" className="mt-5 rounded-xl border border-emerald-400/20 bg-emerald-400/10 p-4 text-sm text-emerald-200">{notice}</p>}
   {org&&<>
    <section className="mt-6 min-w-0 overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-[#1b2c53] to-[#11182d] p-4 sm:p-7">
     <div className="flex min-w-0 flex-wrap items-center gap-4">
      {org.logoUrl?<img src={org.logoUrl} alt={"Logo "+(org.displayName||org.name)}
       className="h-16 w-16 shrink-0 rounded-2xl bg-white object-contain p-1"/>:
       <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-white/20 bg-violet-500/20">
        <Building2 size={29} className="text-violet-200"/></span>}
      <div className="min-w-0 flex-1">
       <p className="text-xs font-bold uppercase tracking-widest text-violet-300">Przestrzeń firmowa</p>
       <h1 className="mt-2 break-words text-2xl font-black sm:text-4xl">{org.displayName||org.name}</h1>
       <p className="mt-2 text-xs text-slate-400">{org.slug} · {roles[org.role]||org.role} · Twoje konto osobiste pozostaje oddzielne</p>
      </div>
      <button type="button" onClick={()=>setRefresh(x=>x+1)}
       className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/20 px-3 text-sm"><RefreshCw size={16}/> Odśwież</button>
     </div>
     <div className="mt-5 flex min-w-0 items-start gap-3 rounded-xl border border-amber-300/20 bg-amber-300/[.065] p-3 text-xs leading-6 text-amber-100">
      <AlertTriangle size={18} className="mt-1 shrink-0"/>
      <span>Ta przestrzeń posiada własne zadania i dostęp zespołu. Istniejące faktury KSeF, historia, agent finansowy i rozmowy ze starego konta nie są tu jeszcze przeniesione ani współdzielone. Nie traktuj widoku osobistego jako finansów tej firmy.</span>
     </div>
    </section>
    <Link href={"/company/"+encodeURIComponent(id)+"/finance"}
      className="mt-4 flex min-w-0 flex-wrap items-center justify-between gap-3 rounded-2xl border border-violet-400/25 bg-violet-400/10 p-4 transition hover:bg-violet-400/15">
      <span className="flex min-w-0 items-center gap-3">
       <span className="rounded-xl bg-violet-500/20 p-2.5 text-violet-200"><Wallet size={22}/></span>
       <span className="min-w-0"><strong className="block text-sm sm:text-base">Finanse i KSeF firmy</strong>
        <span className="mt-1 block text-xs text-slate-300">
         Powiązanie faktur, inwestycje i uprawnienia finansowe pracowników
        </span>
       </span>
      </span>
      <span className="text-xs font-bold text-violet-200">Otwórz finanse</span>
    </Link>
    <div className="mt-5 flex min-w-0 flex-wrap gap-2" role="tablist" aria-label="Zarządzanie firmą">
     {tabs.filter(([key])=>key==="tasks"||(key==="team"||key==="brand")&&isAdmin||key==="domain"&&isOwner)
      .map(([key,label])=><button type="button" key={key} role="tab" aria-selected={tab===key}
       onClick={()=>{setTab(key);setError("");setNotice("");}}
       className={"min-h-11 rounded-xl border px-4 text-sm font-semibold "+(tab===key
        ?"border-violet-300/50 bg-violet-600 text-white"
        :"border-white/15 bg-[#111c35] text-slate-300 hover:bg-white/10")}>{label}</button>)}
    </div>
    {tab==="tasks"&&<div className="mt-5 grid min-w-0 gap-5 lg:grid-cols-[minmax(0,.85fr)_minmax(0,1.15fr)]">
      <form onSubmit={submitTask} className="min-w-0 space-y-4 rounded-3xl border border-white/10 bg-[#111c35] p-4 sm:p-6">
       <h2 className="flex items-center gap-2 text-xl font-bold"><Plus size={18} className="text-violet-300"/> Nowe zadanie firmowe</h2>
       <p className="text-xs leading-5 text-slate-400">Zadanie widzą tylko osoby z aktywnym dostępem do tej firmy.</p>
       <label className="block text-sm">Co trzeba zrobić?
        <input required minLength={3} maxLength={180} value={title} onChange={e=>setTitle(e.target.value)}
         placeholder="np. Przygotować ofertę dla klienta"
         className="mt-2 block w-full min-w-0 rounded-xl border border-white/20 bg-[#0a162d] p-3 text-white outline-none focus:border-violet-400"/>
       </label>
       <label className="block text-sm">Szczegóły
        <textarea rows={4} maxLength={5000} value={description} onChange={e=>setDescription(e.target.value)}
         className="mt-2 block w-full min-w-0 rounded-xl border border-white/20 bg-[#0a162d] p-3 text-white outline-none focus:border-violet-400"/>
       </label>
       <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm">Termin
         <input type="date" value={dueDate} onChange={e=>setDueDate(e.target.value)}
          className="mt-2 block min-h-11 w-full min-w-0 rounded-xl border border-white/20 bg-[#0a162d] p-3 text-white"/>
        </label>
        <label className="text-sm">Priorytet
         <select value={priority} onChange={e=>setPriority(e.target.value)}
          className="mt-2 block min-h-11 w-full min-w-0 rounded-xl border border-white/20 bg-[#0a162d] p-3 text-white">
          <option value="LOW">Niski</option><option value="MEDIUM">Średni</option>
          <option value="HIGH">Wysoki</option><option value="URGENT">Pilny</option>
         </select>
        </label>
       </div>
       <button type="submit" disabled={busy} className="min-h-12 w-full rounded-xl bg-violet-500 font-bold text-white hover:bg-violet-400 disabled:opacity-40">Dodaj zadanie</button>
      </form>
      <section className="min-w-0 overflow-hidden rounded-3xl border border-white/10 bg-[#111c35] p-4 sm:p-6">
       <h2 className="text-xl font-bold">Zadania {org.displayName||org.name}</h2>
       <p className="mt-1 text-xs text-slate-400">{tasks.length} widocznych zadań tej firmy</p>
       <div className="mt-4 max-h-[760px] space-y-3 overflow-y-auto pr-1">
        {tasks.map(t=><article key={t.id} className="min-w-0 rounded-2xl border border-white/10 bg-[#192844] p-4">
         <div className="flex flex-wrap items-center justify-between gap-2">
          <strong className="min-w-0 break-words text-sm">{t.title}</strong>
          <span className="text-xs text-slate-400">{date(t.dueDate)}</span>
         </div>
         {t.description&&<p className="mt-2 whitespace-pre-wrap break-words text-xs leading-6 text-slate-300">{t.description}</p>}
         <div className="mt-3 flex min-w-0 items-center justify-between gap-2">
          <span className="text-[11px] text-slate-400">{t.priority==="URGENT"?"Pilne":t.priority==="HIGH"?"Wysoki priorytet":t.priority==="LOW"?"Niski priorytet":"Średni priorytet"}</span>
          <select aria-label={"Status zadania "+t.title} value={t.status} disabled={busy}
           onChange={e=>mutate(()=>changeOrganizationTaskStatus(id,t.id,e.target.value),"Zmieniono status zadania.")}
           className="min-h-10 max-w-40 rounded-xl border border-white/20 bg-[#101d37] px-3 text-xs text-white disabled:opacity-50">
           {Object.entries(statuses).map(([value,label])=><option key={value} value={value}>{label}</option>)}
          </select>
         </div>
        </article>)}
        {tasks.length===0&&<p className="rounded-xl border border-dashed border-white/15 p-6 text-sm text-slate-400">Brak firmowych zadań. Dodaj pierwsze z lewej strony.</p>}
       </div>
      </section>
     </div>}
    {tab==="team"&&isAdmin&&<section className="mt-5 grid min-w-0 gap-5 lg:grid-cols-2">
      <form onSubmit={invite} className="min-w-0 space-y-4 rounded-3xl border border-white/10 bg-[#111c35] p-4 sm:p-6">
       <h2 className="flex items-center gap-2 text-lg font-bold"><Users className="text-violet-300" size={20}/> Zaproś osobę do firmy</h2>
       <p className="text-xs leading-6 text-slate-400">Osoba powinna mieć własne konto PrzemAI. Zobaczy zaproszenie po zalogowaniu i sama je zaakceptuje. Nie otrzymuje dostępu do Twojego konta osobistego.</p>
       <label className="block text-sm">E-mail pracownika
        <input required type="email" value={memberEmail} onChange={e=>setMemberEmail(e.target.value)}
         placeholder="pracownik@twojafirma.pl" className="mt-2 w-full min-w-0 rounded-xl border border-white/20 bg-[#0a162d] p-3 text-white"/>
       </label>
       <label className="block text-sm">Rola
        <select value={memberRole} onChange={e=>setMemberRole(e.target.value)}
         className="mt-2 w-full min-w-0 rounded-xl border border-white/20 bg-[#0a162d] p-3 text-white">
         <option value="MEMBER">Pracownik — dostęp do zadań firmowych</option>
         {isOwner&&<option value="ADMIN">Administrator — zaproszenia i branding</option>}
        </select>
       </label>
       <button disabled={busy} className="min-h-12 w-full rounded-xl bg-violet-500 font-bold text-white disabled:opacity-40">Wyślij zaproszenie w PrzemAI</button>
      </form>
      <div className="min-w-0 rounded-3xl border border-white/10 bg-[#111c35] p-4 sm:p-6">
       <h2 className="text-lg font-bold">Osoby i uprawnienia</h2>
       <div className="mt-4 space-y-3">{members.map(m=><div key={m.id} className="flex min-w-0 flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-[#182642] p-4">
        <div className="min-w-0"><strong className="block break-all text-sm">{m.user?.email}</strong>
         <p className="mt-1 text-xs text-slate-400">{roles[m.role]||m.role} · {m.status==="ACTIVE"?"Aktywny":m.status==="PENDING"?"Czeka na akceptację":"Dostęp odebrany"}</p>
        </div>
        {isOwner&&m.role!=="OWNER"&&m.status!=="REVOKED"&&<button type="button" disabled={busy}
         onClick={()=>{if(window.confirm("Odebrać dostęp tej osobie do firmy?"))mutate(()=>revokeOrganizationMember(id,m.id),"Dostęp odebrany.");}}
         className="min-h-10 rounded-xl border border-rose-400/30 px-3 text-xs text-rose-200 disabled:opacity-40">Odbierz dostęp</button>}
       </div>)}</div>
      </div>
     </section>}
    {tab==="brand"&&isAdmin&&<form onSubmit={saveBrand}
     className="mt-5 max-w-3xl space-y-4 rounded-3xl border border-white/10 bg-[#111c35] p-4 sm:p-6">
     <h2 className="flex items-center gap-2 text-xl font-bold"><Palette size={20} className="text-violet-300"/> Wygląd firmy</h2>
     <p className="text-sm leading-6 text-slate-400">Ustaw nazwę handlową, kolor i logo widoczne w przestrzeni firmy. Pełne zastąpienie marki PrzemAI na własnej domenie wymaga aktywacji White Label.</p>
     <label className="block text-sm">Nazwa wyświetlana
      <input required minLength={2} maxLength={120} value={displayName} onChange={e=>setDisplayName(e.target.value)}
       className="mt-2 w-full min-w-0 rounded-xl border border-white/20 bg-[#0a162d] p-3 text-white"/>
     </label>
     <label className="block text-sm">Logo firmy — link HTTPS
      <input type="url" value={logoUrl} onChange={e=>setLogoUrl(e.target.value)}
       placeholder="https://twojafirma.pl/logo.png" className="mt-2 w-full min-w-0 rounded-xl border border-white/20 bg-[#0a162d] p-3 text-white"/>
     </label>
     <label className="block text-sm">Kolor identyfikacji
      <div className="mt-2 flex items-center gap-3">
       <input type="color" value={accentColor} onChange={e=>setAccentColor(e.target.value)}
        className="h-12 w-16 shrink-0 cursor-pointer rounded-lg border border-white/15 bg-[#0a162d] p-1"/>
       <span className="text-sm text-slate-400">{accentColor}</span>
      </div>
     </label>
     <button disabled={busy} className="min-h-12 rounded-xl bg-violet-500 px-6 font-bold text-white disabled:opacity-40">Zapisz wygląd firmy</button>
    </form>}
    {tab==="domain"&&isOwner&&<div className="mt-5 grid min-w-0 gap-5 lg:grid-cols-2">
     <form onSubmit={requestDomain} className="min-w-0 space-y-4 rounded-3xl border border-white/10 bg-[#111c35] p-4 sm:p-6">
      <h2 className="flex items-center gap-2 text-xl font-bold"><Globe2 size={20} className="text-violet-300"/> Podłącz własną domenę</h2>
      <p className="text-sm leading-6 text-slate-300">Np. <strong>api.dekonica.com</strong> zamiast przemai.pl. Najpierw potwierdzimy własność domeny rekordem DNS TXT. Weryfikacja nie przekierowuje jeszcze strony — konfiguracja hostingu i SSL jest oddzielnym krokiem.</p>
      <label className="block text-sm">Pełna nazwa domeny
       <input required value={hostname} onChange={e=>setHostname(e.target.value.toLowerCase())}
        placeholder="api.twojafirma.pl" className="mt-2 w-full min-w-0 rounded-xl border border-white/20 bg-[#0a162d] p-3 text-white"/>
      </label>
      <button disabled={busy} className="min-h-12 w-full rounded-xl bg-violet-500 px-4 font-bold text-white disabled:opacity-40">Zgłoś domenę i pobierz DNS TXT</button>
      <div className="space-y-3 border-t border-white/10 pt-4">
       <h3 className="text-sm font-bold">Twoje domeny</h3>
       {org.domains?.map(domain=><div key={domain.id} className="min-w-0 rounded-xl border border-white/10 bg-[#192844] p-4">
        <p className="break-all text-sm font-semibold">{domain.hostname}</p>
        <p className="mt-1 text-xs text-slate-400">{domain.verifiedAt?"Własność potwierdzona — czeka na aktywację hostingu":"Oczekuje na rekord TXT"}</p>
        <div className="mt-3 flex flex-wrap gap-2">
         <button type="button" disabled={!!dnsBusy} onClick={()=>showDNS(domain)}
          className="min-h-10 rounded-xl border border-white/20 px-3 text-xs font-semibold disabled:opacity-40">Instrukcja TXT</button>
         {!domain.verifiedAt&&<button type="button" disabled={!!dnsBusy} onClick={()=>verifyDNS(domain)}
          className="min-h-10 rounded-xl border border-violet-400/30 bg-violet-400/10 px-3 text-xs font-semibold text-violet-200 disabled:opacity-40">Sprawdź DNS</button>}
        </div>
       </div>)}
       {!org.domains?.length&&<p className="text-xs text-slate-400">Nie zgłoszono jeszcze domen.</p>}
      </div>
     </form>
     <div className="min-w-0 space-y-4">
      {dnsRecord?.dns&&<section className="min-w-0 rounded-3xl border border-violet-400/25 bg-[#111c35] p-4 sm:p-6">
       <h3 className="text-lg font-bold">Rekord DNS do dodania</h3>
       <p className="mt-2 text-xs text-slate-300">Dodaj rekord typu TXT u swojego operatora domeny.</p>
       <p className="mt-4 text-xs text-slate-400">Nazwa rekordu</p>
       <div className="mt-1 flex min-w-0 items-center gap-2"><code className="min-w-0 flex-1 break-all rounded-lg bg-[#0a162d] p-3 text-xs">{dnsRecord.dns.record}</code>
        <button type="button" aria-label="Kopiuj nazwę DNS" onClick={()=>navigator.clipboard.writeText(dnsRecord.dns.record)} className="min-h-11 rounded-lg border border-white/10 px-3"><Copy size={16}/></button></div>
       <p className="mt-3 text-xs text-slate-400">Wartość TXT</p>
       <div className="mt-1 flex min-w-0 items-center gap-2"><code className="min-w-0 flex-1 break-all rounded-lg bg-[#0a162d] p-3 text-xs">{dnsRecord.dns.value}</code>
        <button type="button" aria-label="Kopiuj wartość DNS" onClick={()=>navigator.clipboard.writeText(dnsRecord.dns.value)} className="min-h-11 rounded-lg border border-white/10 px-3"><Copy size={16}/></button></div>
      </section>}
      <section className="rounded-3xl border border-white/10 bg-[#111c35] p-4 sm:p-6">
       <h3 className="flex items-center gap-2 text-lg font-bold"><ShieldCheck size={20} className="text-violet-300"/> Bezpieczna konfiguracja</h3>
       <p className="mt-3 text-sm leading-6 text-slate-300">Nigdy nie wpisuj tu hasła do rejestratora domeny. PrzemAI weryfikuje tylko publiczny rekord TXT. Przełączenie domeny i certyfikat HTTPS nastąpią dopiero po osobnym wdrożeniu.</p>
      </section>
     </div>
    </div>}
    <div className="mt-6 flex flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-[#111c35] p-4 text-xs text-slate-400">
     <ShieldCheck size={17} className="shrink-0 text-emerald-300"/>
     Serwer weryfikuje członkostwo przy każdym odczycie i zapisie firmowych zadań.
     <Link href="/" className="ml-auto font-semibold text-violet-300">Powrót do konta osobistego</Link>
    </div>
   </>}
  </div>
 </main>;
}
