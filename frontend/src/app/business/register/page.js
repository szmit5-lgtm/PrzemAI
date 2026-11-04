"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Building2, Globe2, ShieldCheck } from "lucide-react";
import { registerOrganization } from "@/lib/api";

export default function BusinessRegisterPage() {
  const router = useRouter();
  const registrationEnabled = process.env.NEXT_PUBLIC_REGISTRATION_ENABLED !== "false";
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordAgain, setPasswordAgain] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event) {
    event.preventDefault();
    if (!registrationEnabled || loading) return;
    setError("");
    if (password !== passwordAgain) {
      setError("Hasła nie są identyczne.");
      return;
    }
    setLoading(true);
    try {
      const response = await registerOrganization({ name, slug, email: email.trim(), password });
      if (response?.success !== true || !response?.organization?.id ||
          response.user?.email !== email.trim().toLowerCase()) {
        throw new Error("Serwer nie potwierdził utworzenia konta firmowego.");
      }
      router.push("/login?registered=company");
    } catch (err) {
      setError(err?.message || "Nie udało się utworzyć konta firmy.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#070e22] px-4 py-10 text-slate-100">
      <div className="mx-auto max-w-4xl">
        <header className="mb-8 flex flex-wrap items-center justify-between gap-3">
          <Link href="/login" className="text-xl font-black">Przem<span className="text-cyan-300">AI</span></Link>
          <Link href="/login" className="text-sm font-semibold text-cyan-200 hover:text-white">Mam już konto — zaloguj się</Link>
        </header>
        <div className="mb-8">
          <span className="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-xs font-bold text-cyan-200"><Building2 size={15}/> KONTO DLA FIRMY</span>
          <h1 className="mt-4 text-3xl font-black sm:text-4xl">Załóż PrzemAI dla swojej firmy</h1>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-300">Utwórz konto właściciela i przestrzeń firmową. Logo i własną domenę, np. asystent.twojafirma.pl, podłączysz po weryfikacji.</p>
        </div>
        <div className="grid gap-6 md:grid-cols-[1.15fr_1fr]">
          <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-[#14274c] to-[#0b152c] p-6 sm:p-8">
            {!registrationEnabled ? (
              <div role="status">
                <h2 className="text-xl font-bold">Rejestracja jest obecnie wyłączona</h2>
                <p className="mt-3 text-sm leading-7 text-slate-300">Administrator musi uruchomić rejestrację nowych firm. Obecne konta pozostają dostępne.</p>
                <Link href="/login" className="mt-5 inline-block rounded-xl bg-cyan-400 px-5 py-3 font-bold text-slate-950">Przejdź do logowania</Link>
              </div>
            ) : (
              <form className="space-y-4" onSubmit={submit}>
                <div><label htmlFor="business-name" className="mb-1 block text-sm font-semibold">Nazwa firmy</label><input id="business-name" required maxLength={120} value={name} onChange={e=>setName(e.target.value)} placeholder="Np. Dekonica" className="w-full rounded-xl border border-white/15 bg-slate-950/60 px-4 py-3 text-white outline-none focus:border-cyan-400"/></div>
                <div><label htmlFor="business-slug" className="mb-1 block text-sm font-semibold">Identyfikator firmy</label><input id="business-slug" required pattern="[a-z0-9][a-z0-9-]{1,38}[a-z0-9]" minLength={3} maxLength={40} value={slug} onChange={e=>setSlug(e.target.value.toLowerCase())} placeholder="dekonica" className="w-full rounded-xl border border-white/15 bg-slate-950/60 px-4 py-3 text-white outline-none focus:border-cyan-400"/></div>
                <div><label htmlFor="business-email" className="mb-1 block text-sm font-semibold">Adres e-mail właściciela</label><input id="business-email" required type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} className="w-full rounded-xl border border-white/15 bg-slate-950/60 px-4 py-3 text-white outline-none focus:border-cyan-400"/></div>
                <div><label htmlFor="business-password" className="mb-1 block text-sm font-semibold">Hasło</label><input id="business-password" required type="password" minLength={8} autoComplete="new-password" value={password} onChange={e=>setPassword(e.target.value)} className="w-full rounded-xl border border-white/15 bg-slate-950/60 px-4 py-3 text-white outline-none focus:border-cyan-400"/></div>
                <div><label htmlFor="business-password-again" className="mb-1 block text-sm font-semibold">Powtórz hasło</label><input id="business-password-again" required type="password" minLength={8} autoComplete="new-password" value={passwordAgain} onChange={e=>setPasswordAgain(e.target.value)} className="w-full rounded-xl border border-white/15 bg-slate-950/60 px-4 py-3 text-white outline-none focus:border-cyan-400"/></div>
                {error && <p role="alert" className="rounded-xl border border-rose-400/25 bg-rose-400/10 p-3 text-sm text-rose-200">{error}</p>}
                <button type="submit" disabled={loading} className="w-full rounded-xl bg-cyan-400 px-5 py-3.5 font-bold text-slate-950 hover:bg-cyan-300 disabled:opacity-50">{loading ? "Tworzenie konta…" : "Utwórz konto firmowe"}</button>
              </form>
            )}
          </div>
          <section className="space-y-4">
            <div className="rounded-3xl border border-white/10 bg-white/[.045] p-6">
              <h2 className="flex items-center gap-2 text-lg font-bold"><Globe2 size={20} className="text-cyan-300"/> Własna domena i logo</h2>
              <p className="mt-3 text-sm leading-7 text-slate-300">Po rejestracji skonfigurujesz nazwę i identyfikację marki. Domena wymaga weryfikacji DNS oraz aktywacji certyfikatu SSL. Rejestracja nie przełącza jej automatycznie.</p>
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/[.045] p-6">
              <h2 className="flex items-center gap-2 text-lg font-bold"><ShieldCheck size={20} className="text-cyan-300"/> Bezpieczeństwo danych</h2>
              <p className="mt-3 text-sm leading-7 text-slate-300">Uprawnienia pracowników, integracje bankowe i KSeF uruchamiamy osobno po autoryzacji. Nie podawaj haseł bankowych ani kluczy prywatnych w formularzu rejestracji.</p>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
