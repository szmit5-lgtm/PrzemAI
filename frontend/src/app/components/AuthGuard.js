"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { getProfile } from "@/lib/api";
import { parseAuthenticatedProfile } from "@/lib/profilePayload";
import { hasUsableSessionToken } from "@/lib/sessionGate.mjs";

const PUBLIC_PATHS = new Set(["/login", "/register", "/preview", "/business/register"]);

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
    setVerifiedPath(null);

    // Do not call the backend when this browser has no session.
    // In particular, an unavailable preview API must not hide the login page.
    if (!hasUsableSessionToken(window.localStorage)) {
      router.replace("/login");
      return () => { active = false; };
    }

    getProfile()
      .then(data => {
        if (!active) return;
        parseAuthenticatedProfile(data);
        setVerifiedPath(pathname);
      })
      .catch(error => {
        if (!active) return;
        setVerifiedPath(null);
        if (error?.status === 401) {
          router.replace("/login");
        } else {
          setVerificationError("Nie udało się połączyć z API podczas sprawdzania sesji. Spróbuj ponownie lub przejdź do logowania.");
        }
      });

    return () => { active = false; };
  }, [pathname, isPublic, router, retryKey]);

  if (!isPublic && verifiedPath !== pathname) {
    return (
      <div role="status" className="flex min-h-screen items-center justify-center bg-[#070e22] text-slate-100">
        <div className="text-center px-4">
          {verificationError ? (
            <>
              <div role="alert" className="mb-4 max-w-lg text-lg font-semibold">{verificationError}</div>
              <div className="flex flex-wrap justify-center gap-3">
                <button type="button" onClick={() => setRetryKey(value => value + 1)} className="rounded-lg bg-cyan-400 px-5 py-3 font-semibold text-slate-950">Ponów próbę</button>
                <button type="button" onClick={() => router.replace("/login")} className="rounded-lg border border-slate-400 px-5 py-3 font-semibold text-slate-100">Przejdź do logowania</button>
              </div>
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
