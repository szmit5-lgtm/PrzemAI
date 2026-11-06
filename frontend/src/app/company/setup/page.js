"use client";
import {useEffect,useState} from "react";
import Link from "next/link";
import {Building2,Plus,ArrowUpRight,ShieldCheck,Users,Globe2,RefreshCw,CheckCircle2,BriefcaseBusiness} from "lucide-react";
import Navbar from "../../components/Navbar";
import UserMenu from "../../components/UserMenu";
import {createOrganization,getOrganizations,getOrganizationInvitations,acceptOrganizationInvitation} from "@/lib/api";

const slugFromName=text=>String(text||"").toLowerCase()
 .normalize("NFD").replace(/[\u0300-\u036f]/g,"")
 .replace(/ł/g,"l").replace(/[^a-z0-9]+/g,"-")
 .replace(/^-+|-+$/g,"").slice(0,40);
export default function CompanySetupPage(){
 const [name,setName]=useState("");
 const [slug,setSlug]=useState("");
 const [slugEdited,setSlugEdited]=useState(false);
 const [companies,setCompanies]=useState([]);
 const [invitations,setInvitations]=useState([]);
 const [loading,setLoading]=useState(true);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");
 const [notice,setNotice]=useState("");
 const [refresh,setRefresh]=useState(0);

 useEffect(()=>{
  let active=true;setLoading(true);setError("");
  Promise.allSettled([getOrganizations(),getOrganizationInvitations()]).then(([orgs,invites])=>{
    if(!active)return;
    if(orgs.status==="fulfilled")setCompanies(Array.isArray(orgs.value?.data)?orgs.value.data:[]);
    else setError("Nie udało się pobrać listy firm. Odśwież stronę.");
    if(invites.status==="fulfilled")setInvitations(Array.isArray(invites.value?.data)?invites.value.data:[]);
  }).finally(()=>{if(active)setLoading(false);});
  return()=>{active=false;};
 },[refresh]);
 async function create(event){
  event.preventDefault();if(busy)return;
  setBusy(true);setError("");setNotice("");
  try{
   const r=await createOrganization({name:name.trim(),slug:slug.trim().toLowerCase()});
   if(!r?.data?.id)throw Error("Serwer nie potwierdził utworzenia firmy.");
   setName("");setSlug("");setSlugEdited(false);
   setNotice("Utworzono firmę. Otwórz jej panel, aby zaprosić współpracowników i skonfigurować markę.");
   setRefresh(n=>n+1);
  }catch(e){setError(e.message||"Nie udało się utworzyć firmy.");}
  finally{setBusy(false);}
 }
 async function accept(id){
  if(busy)return;setBusy(true);setError("");setNotice("");
  try{
    await acceptOrganizationInvitation(id);
    setNotice("Zaproszenie przyjęte. Firma jest dostępna w Twoim koncie.");
    setRefresh(n=>n+1);
  }catch(e){setError(e.message||"Nie udało się przyjąć zaproszenia.");}
  finally{setBusy(false);}
 }
 return <main className="min-h-screen min-w-0 overflow-x-clip bg-[#080e20] px-3 py-5 text-slate-100 sm:px-6 lg:px-8">
  <div className="mx-auto w-full max-w-7xl min-w-0">
   <header className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-[#111c35] p-4">
    <Link href="/" className="text-xl font-extrabold">Przem<span className="text-violet-300">AI</span></Link><UserMenu/>
   </header>
   <Navbar/>
   <section className="mt-6">
    <div className="flex flex-wrap items-center justify-between gap-3">
     <div><p className="text-xs font-bold uppercase tracking-widest text-violet-300">PrzemAI dla firm</p>
      <h1 className="mt-2 break-words text-3xl font-black sm:text-4xl">Twoje firmy i Grupa</h1>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
       Jedno logowanie pozwala zarządzać wieloma firmami. Każda ma własny panel, członków i zadania firmowe.
       Dane i integracje poprzedniego konta nie są automatycznie udostępniane nowej firmie.
      </p>
     </div>
     <button type="button" onClick={()=>setRefresh(x=>x+1)} disabled={loading||busy}
      className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/20 px-4 text-sm disabled:opacity-40">
      <RefreshCw size={16}/> Odśwież
     </button>
    </div>
    <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
     <div className="rounded-2xl border border-white/10 bg-[#111c35] p-5"><Building2 className="text-violet-300"/><p className="mt-2 text-3xl font-black">{loading?"—":companies.length}</p><p className="text-xs text-slate-400">Firmy na Twoim koncie</p></div>
     <div className="rounded-2xl border border-white/10 bg-[#111c35] p-5"><Users className="text-violet-300"/><p className="mt-2 text-3xl font-black">{loading?"—":invitations.length}</p><p className="text-xs text-slate-400">Zaproszenia do zaakceptowania</p></div>
     <div className="rounded-2xl border border-white/10 bg-[#111c35] p-5"><ShieldCheck className="text-violet-300"/><p className="mt-2 text-sm font-bold">Oddzielne uprawnienia</p><p className="mt-2 text-xs leading-5 text-slate-400">Dostęp do firm sprawdzany przez serwer, niezależnie od wybranego widoku.</p></div>
    </div>
   </section>
   {error&&<p role="alert" className="mt-5 rounded-xl border border-rose-400/30 bg-rose-400/10 p-4 text-sm text-rose-200">{error}</p>}
   {notice&&<p role="status" className="mt-5 rounded-xl border border-emerald-400/20 bg-emerald-400/10 p-4 text-sm text-emerald-200">{notice}</p>}
   {invitations.length>0&&<section className="mt-6 rounded-3xl border border-violet-400/30 bg-violet-400/10 p-5">
     <h2 className="text-lg font-bold">Zaproszenia do firm</h2>
     <p className="mt-1 text-xs text-slate-300">Dostęp zostanie włączony dopiero po Twoim potwierdzeniu.</p>
     <div className="mt-3 grid gap-3 md:grid-cols-2">
      {invitations.map(i=><div key={i.id} className="flex min-w-0 flex-wrap items-center justify-between gap-3 rounded-xl border border-violet-300/20 bg-[#111c35] p-4">
       <div className="min-w-0"><strong className="break-words">{i.organization?.displayName||i.organization?.name}</strong><p className="text-xs text-slate-400">Rola: {i.role==="ADMIN"?"Administrator":"Pracownik"}</p></div>
       <button type="button" onClick={()=>accept(i.organizationId)} disabled={busy}
        className="min-h-11 rounded-xl bg-violet-500 px-4 text-sm font-bold text-white disabled:opacity-50">Przyjmij</button>
      </div>)}
     </div>
    </section>}
   <div className="mt-6 grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(320px,.8fr)]">
    <section className="min-w-0 rounded-3xl border border-white/10 bg-[#111c35] p-4 sm:p-6">
     <h2 className="text-xl font-bold">Przestrzenie firmowe</h2>
     <p className="mt-2 text-sm text-slate-400">Otwórz firmę, aby zarządzać sprawami, dostępem zespołu, logo i domeną.</p>
     <div className="mt-5 space-y-3">
      {companies.map(c=><Link key={c.id} href={"/company/"+encodeURIComponent(c.id)}
       onClick={()=>{localStorage.setItem("przemai-active-organization",c.id);}}
       className="flex min-w-0 flex-wrap items-center gap-3 rounded-2xl border border-white/10 bg-[#172642] p-4 transition hover:border-violet-300/40 hover:bg-[#203252]">
       {c.logoUrl?<img src={c.logoUrl} alt="" className="h-12 w-12 shrink-0 rounded-xl bg-white object-contain p-1"/>:
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-violet-500/15"><Building2 className="text-violet-300" size={24}/></span>}
       <span className="min-w-0 flex-1">
        <strong className="block truncate text-base">{c.displayName||c.name}</strong>
        <span className="mt-1 block text-xs text-slate-400">{c.slug} · {c.role==="OWNER"?"Właściciel":c.role==="ADMIN"?"Administrator":"Pracownik"}</span>
        {c.domains?.some(d=>d.verifiedAt)&&<span className="mt-1 flex items-center gap-1 text-xs text-emerald-300"><CheckCircle2 size={13}/> Domena zweryfikowana</span>}
       </span><ArrowUpRight size={19} className="shrink-0 text-violet-300"/>
      </Link>)}
      {loading&&<p className="py-6 text-sm text-slate-400">Pobieram firmy…</p>}
      {!loading&&companies.length===0&&<p className="rounded-xl border border-dashed border-white/15 p-6 text-sm text-slate-400">
       Nie utworzono jeszcze firmy. Dodaj pierwszą po prawej stronie.
      </p>}
     </div>
    </section>
    <div className="space-y-5">
     <form onSubmit={create} className="min-w-0 space-y-4 rounded-3xl border border-white/10 bg-gradient-to-br from-[#192b50] to-[#10172b] p-4 sm:p-6">
      <h2 className="flex items-center gap-2 text-lg font-bold"><Plus size={20} className="text-violet-300"/> Dodaj kolejną firmę</h2>
      <p className="text-xs leading-5 text-slate-400">Nie potrzebujesz nowego loginu. Każda firma jest osobną przestrzenią.</p>
      <label className="block text-sm font-semibold">Nazwa firmy
       <input required minLength={2} maxLength={120} value={name}
        onChange={e=>{setName(e.target.value);if(!slugEdited)setSlug(slugFromName(e.target.value));}}
        placeholder="np. Dekonica" className="mt-2 block w-full min-w-0 rounded-xl border border-white/20 bg-[#09152d] p-3 text-white outline-none focus:border-violet-400"/>
      </label>
      <label className="block text-sm font-semibold">Identyfikator firmy
       <input required minLength={3} maxLength={40} pattern="[a-z0-9][a-z0-9-]{1,38}[a-z0-9]"
        value={slug} onChange={e=>{setSlugEdited(true);setSlug(e.target.value.toLowerCase());}}
        placeholder="np. dekonica" className="mt-2 block w-full min-w-0 rounded-xl border border-white/20 bg-[#09152d] p-3 text-white outline-none focus:border-violet-400"/>
      </label>
      <button type="submit" disabled={busy} className="min-h-12 w-full rounded-xl bg-violet-500 px-4 font-bold text-white hover:bg-violet-400 disabled:opacity-40">
       {busy?"Tworzenie…":"Utwórz przestrzeń firmy"}
      </button>
     </form>
     <div className="rounded-3xl border border-white/10 bg-[#111c35] p-5">
      <h3 className="flex items-center gap-2 font-bold"><Globe2 size={18} className="text-violet-300"/> Własna marka i domena</h3>
      <p className="mt-3 text-sm leading-6 text-slate-300">Po utworzeniu firmy dodasz logo, kolor i zgłosisz domenę, np. api.dekonica.com. System zweryfikuje rekord DNS TXT. Uruchomienie domeny z SSL jest osobnym etapem.</p>
     </div>
     <div className="rounded-3xl border border-white/10 bg-[#111c35] p-5">
      <h3 className="flex items-center gap-2 font-bold"><BriefcaseBusiness size={18} className="text-violet-300"/> Panel całej grupy</h3>
      <p className="mt-3 text-sm leading-6 text-slate-300">Tutaj widzisz firmy, do których masz dostęp. Ich firmowe zadania są rozdzielone. Wspólny raport finansowy grupy uruchomimy dopiero po bezpiecznym powiązaniu danych każdej spółki.</p>
     </div>
    </div>
   </div>
  </div>
 </main>;
}
