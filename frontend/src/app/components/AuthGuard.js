"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { getProfile } from "@/lib/api";

const PUBLIC_PATHS = new Set(["/login", "/register", "/preview"]);

export default function AuthGuard({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const [verifiedPath, setVerifiedPath] = useState(null);
  const isPublic = PUBLIC_PATHS.has(pathname);

  useEffect(() => {
    if (isPublic) return;
    let active = true;

    getProfile()
      .then(() => { if (active) setVerifiedPath(pathname); })
      .catch(() => {
        if (active) {
          setVerifiedPath(null);
          router.replace("/login");
        }
      });

    return () => { active = false; };
  }, [pathname, isPublic, router]);

  if (!isPublic && verifiedPath !== pathname) {
    return (
      <div role="status" className="flex min-h-screen items-center justify-center bg-[#070e22] text-slate-100">
        <div className="text-center">
          <div className="mb-4 text-4xl" aria-hidden="true">🧠</div>
          <div className="text-lg font-semibold">Sprawdzanie sesji…</div>
        </div>
      </div>
    );
  }

  return children;
}
