"use client";

import { useEffect, useState } from "react";

export default function MobileConnection() {
  const [offline, setOffline] = useState(false);
  const [updateReady, setUpdateReady] = useState(false);

  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    update();
    localStorage.removeItem("token");
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    if (process.env.NODE_ENV === "production" && window.isSecureContext && navigator.serviceWorker) {
      navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" }).then(registration => {
        const report = () => {
          if (registration.waiting && navigator.serviceWorker.controller) setUpdateReady(true);
        };
        report();
        registration.addEventListener("updatefound", () => {
          registration.installing?.addEventListener("statechange", report);
        });
      }).catch(error => {
        console.warn("Nie udało się uruchomić ekranu offline.", error);
      });
    }
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  return offline ? (
    <div role="status" className="sticky top-0 z-[60] bg-amber-300 px-3 py-2 text-center text-sm font-semibold text-slate-950">
      Brak połączenia. Wysyłanie będzie dostępne po odzyskaniu internetu.
    </div>
  ) : updateReady ? (
    <div role="status" className="sticky top-0 z-[60] bg-indigo-100 px-3 py-2 text-center text-sm text-slate-950">
      Dostępna jest nowa wersja.
      <button type="button" className="ml-2 min-h-11 px-2 font-semibold underline" onClick={() => {
        navigator.serviceWorker.addEventListener("controllerchange", () => window.location.reload(), { once: true });
        void navigator.serviceWorker.getRegistration().then(registration => registration?.waiting?.postMessage("ACTIVATE_UPDATE"));
      }}>Odśwież aplikację</button>
    </div>
  ) : null;
}
