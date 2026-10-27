"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, UserCircle2, CheckSquare } from "lucide-react";
import { getProfile, getTasks } from "@/lib/api";

export default function UserMenu() {
  const [user, setUser] = useState(null);
  const [taskCount, setTaskCount] = useState(null);
  const dark = usePathname() === "/";

  useEffect(() => {
    let active = true;
    getProfile().then(data => { if (active) setUser(data?.user || null); }).catch(() => {});
    // Task retrieval is optional: an unavailable task endpoint must not log the user out.
    getTasks().then(data => { if (active) setTaskCount(data?.items?.length ?? null); }).catch(() => {});
    return () => { active = false; };
  }, []);

  function logout() {
    localStorage.removeItem("token");
    window.location.assign("/login");
  }

  return (
    <div className={`flex min-w-0 flex-wrap items-center gap-2 text-sm ${dark ? "text-slate-200" : "text-slate-700"}`}>
      {user && <span className="inline-flex min-w-0 items-center gap-2" title={user.email}>
        <UserCircle2 size={20} className={dark ? "text-cyan-300" : "text-blue-600"} />
        <span className="max-w-40 truncate sm:max-w-56">{user.email}</span>
      </span>}
      {taskCount !== null && <Link href="/tasks" aria-label={`Zadania: ${taskCount}`} className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 ${dark ? "bg-white/10" : "bg-slate-100"}`}><CheckSquare size={15}/>{taskCount}</Link>}
      <button type="button" onClick={logout} className={`inline-flex items-center gap-1 rounded-lg border px-3 py-2 transition ${dark ? "border-white/15 hover:bg-white/10" : "border-slate-200 hover:bg-slate-100"}`}><LogOut size={15}/>Wyloguj</button>
    </div>
  );
}
