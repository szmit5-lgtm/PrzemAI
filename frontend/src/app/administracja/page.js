"use client";
import {useEffect,useState} from "react";
import Link from "next/link";
import {Building2,ShieldCheck,Users,RefreshCw,Pencil,Save,X} from "lucide-react";
import Navbar from "../components/Navbar";
import UserMenu from "../components/UserMenu";
import {getProfile,getOrganizations,getSystemUsers,updateSystemUser} from "@/lib/api";

export default function Administracja(){
 const [companies,setCompanies]=useState([]);
 const [isSystemAdmin,setSystemAdmin]=useState(false);
 const [authorized,setAuthorized]=useState(false);
 const [users,setUsers]=useState([]);
 const [cursor,setCursor]=useState(null);
 const [loading,setLoading]=useState(true);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");
 const [refresh,setRefresh]=useState(0);
 const [editing,setEditing]=useState(null);
 const [editEmail,setEditEmail]=useState("");
 const [originalEmail,setOriginalEmail]=useState("");
 const [saving,setSaving]=useState(false);
 useEffect(()=>{
  let active=true;setLoading(true);setError("");
  getProfile().then(async profile=>{
   if(!active)return;
   const allowed=profile?.user?.email?.trim().toLowerCase()==="p.szmitkowski@dekonica.com";
   setAuthorized(allowed);
   if(!allowed)return;
   const orgs=await getOrganizations();
   if(!active)return;
   const administrator=profile?.user?.role==="admin";
   setSystemAdmin(administrator);
   const memberships=Array.isArray(orgs?.data)?orgs.data:[];
   setCompanies(memberships.filter(c=>["OWNER","ADMIN"].includes(c.role)));
   if(administrator){
    const response=await getSystemUsers();
    if(active){setUsers(response.data?.items||[]);setCursor(response.data?.nextCursor||null);}
   }
  }).catch(e=>{if(active)setError(e.message||"Nie udało się otworzyć administracji.");})
  .finally(()=>{if(active)setLoading(false);});
  return()=>{active=false;};
 },[refresh]);
 async function saveEdit(){
  if(!editing||saving)return;
  if(!window.confirm("Zapisać nowy adres e-mail użytkownika? Zmiana może wymagać ponownego zalogowania."))return;
  setSaving(true);setError("");
  try {
   const result=await updateSystemUser(editing,{email:editEmail.trim(),expectedEmail:originalEmail});
   setUsers(items=>items.map(u=>u.id===editing?{...u,...result.data}:u));
   setEditing(null);
  }catch(e){setError(e.message||"Nie udało się zapisać zmian.");}
  finally{setSaving(false);}
 }
 async function more(){
  if(!cursor||busy)return;
  setBusy(true);setError("");
  try{
   const response=await getSystemUsers(cursor);
   setUsers(x=>[...x,...(response.data?.items||[])]);
   setCursor(response.data?.nextCursor||null);
  }catch(e){setError(e.message||"Nie udało się pobrać użytkowników.");}
  finally{setBusy(false);}
 }
 return <main className="min-h-screen bg-[#080e20] px-3 py-5 text-slate-100 sm:px-6 lg:px-8">
  <div className="mx-auto max-w-7xl">
   <header className="flex items-center justify-between rounded-2xl border border-white/10 bg-[#111c35] p-4">
    <Link href="/" className="text-xl font-black">Przem<span className="text-violet-300">AI</span></Link><UserMenu/>
   </header>
   <Navbar/>
   <div className="flex flex-wrap items-center justify-between gap-3">
    <div><p className="text-xs font-bold uppercase tracking-widest text-violet-300">Zarządzanie dostępem</p>
     <h1 className="mt-2 text-3xl font-black">Administracja</h1>
     <p className="mt-2 text-sm text-slate-300">Uprawnienia każdej firmy pozostają oddzielne od administracji całego PrzemAI.</p>
    </div>
    <button className="flex min-h-11 items-center gap-2 rounded-xl border border-white/20 px-4 text-sm" onClick={()=>setRefresh(v=>v+1)}><RefreshCw size={16}/> Odśwież</button>
   </div>
   {error&&<p role="alert" className="mt-4 rounded-xl border border-rose-400/30 bg-rose-400/10 p-4">{error}</p>}
   {loading&&<p className="mt-5 text-slate-400">Ładuję uprawnienia…</p>}
   {!loading&&!authorized&&<p role="alert" className="mt-6 rounded-xl border border-rose-400/30 bg-rose-400/10 p-4">Brak dostępu do administracji. Ten panel jest przeznaczony wyłącznie dla wskazanego konta Dekonica.</p>}
   {!loading&&authorized&&<section className="mt-6 rounded-3xl border border-white/10 bg-[#111c35] p-5">
    <h2 className="flex items-center gap-2 text-xl font-bold"><Building2 className="text-violet-300"/> Administracja firm</h2>
    <p className="mt-2 text-sm text-slate-300">Otwórz firmę i wybierz „Zespół”, aby zobaczyć obecnych pracowników, zaproszenia i odebrać dostęp. Finansami i KSeF zarządzasz osobno w panelu finansowym firmy.</p>
    <div className="mt-4 grid gap-3 md:grid-cols-2">
     {companies.map(c=><div key={c.id} className="rounded-xl border border-white/10 bg-[#192844] p-4">
      <strong>{c.displayName||c.name}</strong><p className="mt-1 text-xs text-slate-400">{c.role==="OWNER"?"Właściciel":"Administrator firmy"}</p>
      <div className="mt-3 flex flex-wrap gap-2">
       <Link className="rounded-lg bg-violet-600 px-3 py-2 text-sm font-semibold" href={"/company/"+encodeURIComponent(c.id)}>Zespół i zaproszenia</Link>
       <Link className="rounded-lg border border-white/20 px-3 py-2 text-sm" href={"/company/"+encodeURIComponent(c.id)+"/finance"}>Finanse i KSeF</Link>
      </div>
     </div>)}
     {!companies.length&&<p className="text-sm text-slate-400">Nie masz obecnie roli administratora w żadnej firmie.</p>}
    </div>
   </section>}
   {!loading&&authorized&&isSystemAdmin&&<section className="mt-5 rounded-3xl border border-white/10 bg-[#111c35] p-5">
    <h2 className="flex items-center gap-2 text-xl font-bold"><Users className="text-violet-300"/> Użytkownicy PrzemAI</h2>
    <p className="mt-2 text-xs text-slate-400">Widok wyłącznie dla administratora systemu. Utworzenie konta nie przyznaje dostępu do żadnej firmy ani KSeF.</p>
    <div className="mt-4 space-y-2">
     {users.map(u=><div key={u.id} className="rounded-xl border border-white/10 bg-[#192844] p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
       <p className="break-all font-semibold">{u.email}</p>
       {u.role!=="admin"&&u.email?.trim().toLowerCase()!=="p.szmitkowski@dekonica.com"&&<button type="button" className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-white/20 px-3 text-sm hover:bg-white/10" onClick={()=>{setEditing(u.id);setEditEmail(u.email);setOriginalEmail(u.email);setError("");}}><Pencil size={15}/> Edytuj</button>}
      </div>
      {editing===u.id&&<div className="mt-3 space-y-2 rounded-xl border border-violet-400/30 bg-[#111c35] p-3">
       <label className="block text-xs text-slate-300" htmlFor={"email-"+u.id}>Adres e-mail konta</label>
       <input id={"email-"+u.id} type="email" value={editEmail} onChange={e=>setEditEmail(e.target.value)} maxLength={254} autoComplete="off" className="min-h-11 w-full rounded-lg border border-white/20 bg-[#080e20] px-3 text-sm text-white" />
       <p className="text-xs text-slate-400">Zmiana adresu logowania. Uprawnienia firm, KSeF i hasło pozostają bez zmian.</p>
       <div className="flex flex-wrap gap-2">
        <button type="button" disabled={saving||!editEmail.trim()||editEmail.trim().toLowerCase()===u.email} onClick={saveEdit} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-violet-600 px-4 text-sm font-bold disabled:opacity-50"><Save size={16}/>{saving?"Zapisuję…":"Zapisz"}</button>
        <button type="button" disabled={saving} onClick={()=>setEditing(null)} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-white/20 px-4 text-sm"><X size={16}/> Anuluj</button>
       </div>
      </div>}
      <p className="mt-1 text-xs text-slate-400">Konto od {new Date(u.createdAt).toLocaleDateString("pl-PL")} · {u.role==="admin"?"Admin systemu":"Użytkownik"}</p>
      <p className="mt-1 text-xs text-slate-400">{u.organizationMemberships?.map(m=>(m.organization?.name||"Firma")+" ("+(m.status==="ACTIVE"?"aktywny":"zaproszony")+")").join(", ")||"Bez przypisanej firmy"}</p>
     </div>)}
    </div>
    {cursor&&<button disabled={busy} onClick={more} className="mt-4 min-h-11 rounded-xl border border-white/20 px-4 text-sm disabled:opacity-40">Pokaż kolejne konta</button>}
   </section>}
   {!loading&&authorized&&!isSystemAdmin&&<p className="mt-5 flex items-center gap-2 text-xs text-slate-400"><ShieldCheck size={17}/> Rejestr wszystkich kont PrzemAI jest dostępny tylko dla zweryfikowanego administratora systemu.</p>}
  </div>
 </main>;
}
