"use client";

import { useEffect, useState } from "react";

export default function MobileConnection() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    update();
    localStorage.removeItem("token");
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    if (process.env.NODE_ENV === "production" && window.isSecureContext && navigator.serviceWorker) {
      navigator.serviceWorker.register("/sw.js").catch(error => {
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
  ) : null;
}
