"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, UserCircle2, CheckSquare, Building2 } from "lucide-react";
import { getProfile, getTasks, getOrganizations } from "@/lib/api";

const frontendBuild = process.env.NEXT_PUBLIC_PRZEMAI_BUILD || "lokalna";

export default function UserMenu() {
  const [user, setUser] = useState(null);
  const [taskCount, setTaskCount] = useState(null);
  const [companies,setCompanies]=useState([]);
  const pathname=usePathname();
  const dark=pathname==="/" || ["/finance","/agents","/tasks","/chat","/document","/meeting","/history","/memory","/settings","/company"].some(prefix=>pathname===prefix||pathname.startsWith(prefix+"/"));

  useEffect(() => {
    let active = true;
    getProfile().then(data => { if (active) setUser(data?.user || null); }).catch(() => {});
    // Task retrieval is optional: an unavailable task endpoint must not log the user out.
    getTasks().then(data => { if (active) setTaskCount(data?.items?.length ?? null); }).catch(() => {});
    getOrganizations().then(data => { if(active)setCompanies(Array.isArray(data?.data)?data.data:[]); }).catch(()=>{});
    return () => { active = false; };
  }, []);

  function logout() {
    localStorage.removeItem("token");
    localStorage.removeItem("przemai-active-organization");
    window.location.assign("/login");
  }

  const companyRoute=pathname.match(/^\/company\/([^/]+)$/);
  const activeCompany=companyRoute?decodeURIComponent(companyRoute[1]):"";

  function chooseCompany(id){
    if(id){
      localStorage.setItem("przemai-active-organization",id);
      window.location.assign("/company/"+encodeURIComponent(id));
    }else{
      localStorage.removeItem("przemai-active-organization");
      window.location.assign("/");
    }
  }

  return (
    <div className={`flex min-w-0 flex-wrap items-center gap-2 text-sm ${dark ? "text-slate-200" : "text-slate-700"}`}>
      {user && <span className="inline-flex min-w-0 items-center gap-2" title={user.email}>
        <UserCircle2 size={20} className={dark ? "text-violet-300" : "text-blue-600"} />
        <span className="max-w-40 truncate sm:max-w-56">{user.email}</span>
      </span>}
      {companies.length>0&&<label className="inline-flex min-w-0 items-center gap-1 text-xs text-slate-400">
        <Building2 size={15} className="shrink-0 text-violet-300"/>
        <span className="sr-only">Przełącz firmę</span>
        <select aria-label="Przełącz firmę" value={activeCompany}
          onChange={event=>chooseCompany(event.target.value)}
          className={"min-h-10 max-w-[175px] rounded-lg border px-2 text-xs font-semibold sm:max-w-[230px] "+(dark?"border-white/15 bg-[#172642] text-slate-100":"border-slate-200 bg-white text-slate-800")}>
          <option value="">Konto osobiste</option>
          {companies.map(company=><option key={company.id} value={company.id}>{company.displayName||company.name}</option>)}
        </select>
       </label>}
      {taskCount !== null && <Link href="/tasks" aria-label={`Zadania: ${taskCount}`} className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 ${dark ? "bg-white/10" : "bg-slate-100"}`}><CheckSquare size={15}/>{taskCount}</Link>}
      <span title="Wersja interfejsu, nie backendu" className="text-xs opacity-70">UI {frontendBuild}</span>
      <button type="button" onClick={logout} className={`inline-flex items-center gap-1 rounded-lg border px-3 py-2 transition ${dark ? "border-white/15 hover:bg-white/10" : "border-slate-200 hover:bg-slate-100"}`}><LogOut size={15}/>Wyloguj</button>
    </div>
  );
}
