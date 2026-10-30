"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { getProfile } from "@/lib/api";

const PUBLIC_PATHS = new Set(["/login", "/register", "/preview"]);

export default function AuthGuard({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const [verifiedPath, setVerifiedPath] = useState(null);
  const [verificationError, setVerificationError] = useState("");
  const [retryKey, setRetryKey] = useState(0);
  const isPublic = PUBLIC_PATHS.has(pathname);

  useEffect(() => {
    if (isPublic) return;
    let active = true;
    setVerificationError("");

    getProfile()
      .then(() => { if (active) setVerifiedPath(pathname); })
.catch(error => {
        if (!active) return;
        setVerifiedPath(null);
        if (error?.status === 401) {
          router.replace("/login");
        } else {
          setVerificationError("Nie udało się sprawdzić sesji. Spróbuj ponownie.");
        }
      });

    return () => { active = false; };
  }, [pathname, isPublic, router, retryKey]);

  if (!isPublic && verifiedPath !== pathname) {
    return (
      <div role="status" className="flex min-h-screen items-center justify-center bg-[#070e22] text-slate-100">
        <div className="text-center">
          {verificationError ? (
            <>
              <div role="alert" className="mb-4 text-lg font-semibold">{verificationError}</div>
              <button type="button" onClick={() => setRetryKey(value => value + 1)} className="rounded-lg bg-cyan-400 px-5 py-3 font-semibold text-slate-950">Ponów próbę</button>
            </>
          ) : (
            <>
              <div className="mb-4 text-4xl" aria-hidden="true">🧠</div>
              <div className="text-lg font-semibold">Sprawdzanie sesji…</div>
            </>
          )}
        </div>
      </div>
    );
  }

  return children;
}
