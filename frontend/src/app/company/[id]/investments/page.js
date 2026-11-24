"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Building2, FolderKanban, Plus, RefreshCw, ShieldCheck, Save } from "lucide-react";
import Navbar from "../../../components/Navbar";
import UserMenu from "../../../components/UserMenu";
import {
  getOrganization, getOrganizationMembers, getOrganizationInvestments, assignOrganizationInvestmentMembers,
  createOrganizationInvestment, updateOrganizationInvestment
} from "@/lib/api";

const statusOptions = [
  ["NOT_SET", "Nie określono"], ["IN_PROGRESS", "W realizacji"],
  ["ON_HOLD", "Wstrzymana"], ["COMPLETED", "Zakończona"]
];
const statusLabels = Object.fromEntries(statusOptions);
function AssignmentPanel({ item, members, busy, save }) {
  const [selected, setSelected] = useState(item.assignedUserIds || []);
  const activeMembers = members.filter(member => member.status === "ACTIVE" && member.user?.id);
  return <form onSubmit={e => { e.preventDefault(); save(item.id, selected); }}
    className="mt-4 space-y-3 rounded-xl border border-cyan-400/25 bg-cyan-500/5 p-4">
    <h3 className="font-semibold">Przypisz pracowników do inwestycji</h3>
    <p className="text-xs text-slate-300">Dostęp do inwestycji otrzymają wyłącznie wskazani aktywni członkowie tej spółki. Finanse pozostają oddzielnie chronione.</p>
    {activeMembers.map(member => <label key={member.user.id} className="flex min-h-11 items-center gap-3 text-sm">
      <input type="checkbox" checked={selected.includes(member.user.id)}
        onChange={e => setSelected(current => e.target.checked
          ? [...current, member.user.id]
          : current.filter(id => id !== member.user.id))}
        className="h-4 w-4" />
      <span>{member.user.email} ({member.role})</span>
    </label>)}
    {!activeMembers.length && <p className="text-sm text-amber-200">Brak aktywnych pracowników do przypisania.</p>}
    <button type="submit" disabled={busy} className="min-h-11 rounded-xl bg-cyan-700 px-4 font-semibold text-white disabled:opacity-50">Zapisz przypisania</button>
  </form>;
}
function EditPanel({ item, busy, save }) {
  const [status, setStatus] = useState(item.status || "NOT_SET");
  const [progress, setProgress] = useState(item.progress == null ? "" : String(item.progress));
  const [description, setDescription] = useState(item.description || "");
  return <form onSubmit={e => { e.preventDefault(); save(item.id, {
    status, progress: progress === "" ? null : Number(progress), description
  }); }} className="mt-4 space-y-3 rounded-xl border border-violet-400/25 bg-violet-500/5 p-4">
    <label className="block text-sm">Status
      <select value={status} onChange={e=>setStatus(e.target.value)}
        className="mt-1 block min-h-11 w-full rounded-lg border border-white/15 bg-[#101b34] px-3">
        {statusOptions.map(([value, label])=><option key={value} value={value}>{label}</option>)}
      </select>
    </label>
    <label className="block text-sm">Postęp (%)
      <input type="number" min="0" max="100" step="1" value={progress}
        onChange={e=>setProgress(e.target.value)} placeholder="Nie podano"
        className="mt-1 block min-h-11 w-full rounded-lg border border-white/15 bg-[#101b34] px-3"/>
    </label>
    <label className="block text-sm">Opis / aktualny zakres prac
      <textarea maxLength={4000} rows={3} value={description} onChange={e=>setDescription(e.target.value)}
        className="mt-1 block w-full rounded-lg border border-white/15 bg-[#101b34] p-3"/>
    </label>
    <button disabled={busy} type="submit" className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-violet-600 px-4 font-bold text-white disabled:opacity-50"><Save size={16}/> Zapisz aktualizację</button>
  </form>;
}
export default function CompanyInvestments() {
  const { id } = useParams();
  const [company, setCompany] = useState(null);
  const [items, setItems] = useState([]);
  const [members, setMembers] = useState([]);
  const [membersLoaded, setMembersLoaded] = useState(false);
  const [assignmentId, setAssignmentId] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [editId, setEditId] = useState("");
  useEffect(() => {
    if (!id) return;
    let active = true;
    setLoading(true); setError(""); setItems([]); setCompany(null); setMembers([]); setMembersLoaded(false);
    Promise.all([getOrganization(id),getOrganizationInvestments(id)]).then(([c,p])=>{
      if (!active) return;
      if (c?.data?.id !== id || !Array.isArray(p?.data?.items)) throw new Error("Nie udało się potwierdzić danych spółki.");
      setCompany(c.data); setItems(p.data.items);
      if (["OWNER", "ADMIN"].includes(c.data.role)) {
        getOrganizationMembers(id).then(result => {
          if (active && Array.isArray(result?.data)) { setMembers(result.data); setMembersLoaded(true); }
        }).catch(e => { if (active) setError(e?.message || "Nie udało się pobrać listy pracowników."); });
      }
    }).catch(e=>{if(active)setError(e?.message||"Nie udało się pobrać inwestycji.");})
      .finally(()=>{if(active)setLoading(false);});
    return ()=>{active=false;};
  },[id,refresh]);
  const canEdit = ["OWNER","ADMIN"].includes(company?.role);
  async function create(e) {
    e.preventDefault();
    if (busy) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const result=await createOrganizationInvestment(id,{name:newName,description:newDescription});
      if(!result?.data?.id) throw new Error("Nie otrzymano potwierdzenia dodania inwestycji.");
      setNewName(""); setNewDescription("");
      setNotice("Inwestycja dodana. Przypisz pracowników, aby mogli ją zobaczyć.");
      setRefresh(n=>n+1);
    } catch(e){setError(e?.message||"Nie udało się dodać inwestycji.");}
    finally{setBusy(false);}
  }
  async function save(investmentId,payload) {
    if (busy) return;
    setBusy(true);setError("");setNotice("");
    try{
      const result=await updateOrganizationInvestment(id,investmentId,payload);
      if(!result?.data?.id) throw new Error("Brak potwierdzenia aktualizacji.");
      setItems(current=>current.map(item=>item.id===investmentId?result.data:item));
      setEditId("");
      setNotice("Zaktualizowano wpis inwestycji.");
    }catch(e){setError(e?.message||"Nie udało się zapisać zmian.");}
    finally{setBusy(false);}
  }
  async function saveAssignments(investmentId, userIds) {
    if (busy) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const result = await assignOrganizationInvestmentMembers(id, investmentId, userIds);
      if (!result?.data?.id) throw new Error("Brak potwierdzenia przypisania.");
      setItems(current => current.map(item => item.id === investmentId ? result.data : item));
      setAssignmentId("");
      setNotice("Zapisano przypisania pracowników.");
    } catch (e) { setError(e?.message || "Nie udało się zapisać przypisań."); }
    finally { setBusy(false); }
  }
  return <main className="min-h-screen min-w-0 overflow-x-clip bg-[#080e20] px-3 py-5 pb-28 text-slate-100 sm:px-6 lg:px-8">
    <div className="mx-auto w-full max-w-7xl">
      <header className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-[#111c35] p-4">
        <Link href={"/company/"+encodeURIComponent(id)} className="inline-flex items-center gap-2 text-sm font-semibold text-violet-200">
          <ArrowLeft size={18}/> Powrót do spółki
        </Link><UserMenu/>
      </header>
      <Navbar/>
      <section className="rounded-3xl border border-violet-400/25 bg-gradient-to-r from-[#241847] to-[#103657] p-5 sm:p-7">
        <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-violet-200"><FolderKanban size={16}/> Projekty zespołu</p>
        <h1 className="mt-2 break-words text-2xl font-black sm:text-4xl">Inwestycje — {company?.displayName||company?.name||"spółka"}</h1>
        <p className="mt-3 text-sm text-slate-200">Pracownicy widzą tylko przypisane im inwestycje. Finanse KSeF i banków pozostają oddzielnie chronione.</p>
      </section>
      {loading&&<p role="status" className="mt-5 text-slate-300">Pobieram inwestycje tej spółki…</p>}
      {error&&<p role="alert" className="mt-5 rounded-xl border border-rose-400/30 bg-rose-500/10 p-4 text-sm text-rose-200">{error}</p>}
      {notice&&<p role="status" className="mt-5 rounded-xl border border-emerald-400/30 bg-emerald-400/10 p-4 text-sm text-emerald-200">{notice}</p>}
      {company&&<>
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-slate-300"><Building2 size={16} className="mr-2 inline text-violet-300"/><strong>{company.displayName||company.name}</strong> · {items.length} inwestycji</p>
          <button type="button" onClick={()=>setRefresh(n=>n+1)} disabled={busy} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/20 px-4 text-sm"><RefreshCw size={16}/> Odśwież</button>
        </div>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          {items.map(item=><article key={item.id} className="min-w-0 rounded-2xl border border-white/10 bg-[#111c35] p-5">
            <div className="flex items-center gap-3"><span className="rounded-xl bg-cyan-500/15 p-3 text-cyan-300"><Building2 size={22}/></span>
              <div className="min-w-0"><h2 className="break-words text-xl font-bold">{item.name}</h2><p className="mt-1 text-xs text-slate-400">Status: {statusLabels[item.status]||"Nie określono"}</p></div>
            </div>
            {item.description&&<p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-slate-300">{item.description}</p>}
            {item.progress!=null&&<div className="mt-4">
              <div className="flex justify-between text-xs"><span>Postęp potwierdzony przez zespół</span><strong>{item.progress}%</strong></div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-cyan-400" style={{width:item.progress+"%"}}/></div>
            </div>}
            {item.source==="INITIAL_REFERENCE"&&<p className="mt-3 text-xs text-amber-200">Wpis startowy — zakres i postęp wymagają uzupełnienia.</p>}
            {canEdit&&<button type="button" onClick={()=>setEditId(editId===item.id?"":item.id)}
              className="mt-4 min-h-11 rounded-xl border border-violet-400/30 px-4 text-sm font-semibold text-violet-200">
              {editId===item.id?"Zamknij edycję":"Aktualizuj"}
            </button>}
            {canEdit&&<button type="button" onClick={()=>setAssignmentId(assignmentId===item.id?"":item.id)}
              className="ml-2 mt-4 min-h-11 rounded-xl border border-cyan-400/30 px-4 text-sm font-semibold text-cyan-200">
              {assignmentId===item.id?"Zamknij przypisania":"Przypisz pracowników"}
            </button>}
            {canEdit&&assignmentId===item.id&&!membersLoaded&&<p role="status" className="mt-3 text-sm text-amber-200">Lista pracowników nie jest dostępna. Przypisywanie jest zablokowane do czasu jej pobrania.</p>}
            {canEdit&&assignmentId===item.id&&membersLoaded&&<AssignmentPanel key={item.id} item={item} members={members} busy={busy} save={saveAssignments}/>}
            {canEdit&&editId===item.id&&<EditPanel key={item.id} item={item} busy={busy} save={save}/>}
          </article>)}
        </div>
        {!items.length&&<div className="mt-5 rounded-xl border border-dashed border-white/15 p-6 text-sm text-slate-400">
          Brak dostępnych inwestycji. Właściciel lub administrator może dodać inwestycje i przypisać pracowników.
        </div>}
        {canEdit&&<form onSubmit={create} className="mt-6 max-w-2xl space-y-4 rounded-2xl border border-white/10 bg-[#111c35] p-5">
          <h2 className="flex items-center gap-2 text-lg font-bold"><Plus size={18} className="text-violet-300"/> Dodaj inwestycję spółki</h2>
          <label className="block text-sm">Nazwa<input required minLength={3} maxLength={160} value={newName} onChange={e=>setNewName(e.target.value)}
            placeholder="np. Nowa inwestycja" className="mt-2 block min-h-11 w-full rounded-lg border border-white/15 bg-[#101b34] px-3"/></label>
          <label className="block text-sm">Opis<textarea rows={3} maxLength={4000} value={newDescription} onChange={e=>setNewDescription(e.target.value)}
            className="mt-2 block w-full rounded-lg border border-white/15 bg-[#101b34] p-3"/></label>
          <button type="submit" disabled={busy||newName.trim().length<3}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-violet-600 px-5 font-bold disabled:opacity-50"><Plus size={17}/> Dodaj inwestycję</button>
        </form>}
        <p className="mt-5 flex items-center gap-2 text-xs text-slate-400"><ShieldCheck size={15}/> Widok nie obejmuje prywatnych finansów właściciela ani danych innych firm.</p>
      </>}
    </div>
  </main>;
}
