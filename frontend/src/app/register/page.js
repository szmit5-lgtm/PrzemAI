"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { register } from "@/lib/api";

export default function RegisterPage() {

    const router = useRouter();

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [passwordRepeat, setPasswordRepeat] = useState("");

    const [loading, setLoading] = useState(false);

    async function handleSubmit(e) {

        e.preventDefault();

        if (password.length < 8) {

            alert("Hasło musi mieć co najmniej 8 znaków.");
            return;

        }

        if (password !== passwordRepeat) {

            alert("Podane hasła nie są identyczne.");
            return;

        }

        setLoading(true);

        try {

            await register(
                email,
                password
            );

            alert("Konto zostało utworzone. Możesz się teraz zalogować.");

            router.push("/login");

        }
        catch (err) {

            alert(err.message);

        }
        finally {

            setLoading(false);

        }

    }

    return (

        <main className="min-h-screen bg-slate-100 flex items-center justify-center p-6">

            <form
                onSubmit={handleSubmit}
                className="w-full max-w-md rounded-3xl bg-white shadow-xl p-10"
            >

                <div className="text-center">

                    <div className="text-6xl">
                        🧠
                    </div>

                    <h1 className="mt-6 text-4xl font-bold">
                        Załóż konto
                    </h1>

                    <p className="mt-2 text-slate-500">
                        PrzemAI
                    </p>

                </div>

                <div className="mt-10">

                    <label className="block text-sm font-medium mb-2">
                        E-mail
                    </label>

                    <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full rounded-xl border px-4 py-4 outline-none focus:ring-2 focus:ring-blue-500"
                    />

                </div>

                <div className="mt-6">

                    <label className="block text-sm font-medium mb-2">
                        Hasło
                    </label>

                    <input
                        type="password"
                        required
                        minLength={8}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full rounded-xl border px-4 py-4 outline-none focus:ring-2 focus:ring-blue-500"
                    />

                    <p className="mt-2 text-xs text-slate-400">
                        Minimum 8 znaków.
                    </p>

                </div>

                <div className="mt-6">

                    <label className="block text-sm font-medium mb-2">
                        Powtórz hasło
                    </label>

                    <input
                        type="password"
                        required
                        minLength={8}
                        value={passwordRepeat}
                        onChange={(e) => setPasswordRepeat(e.target.value)}
                        className="w-full rounded-xl border px-4 py-4 outline-none focus:ring-2 focus:ring-blue-500"
                    />

                </div>

                <button
                    type="submit"
                    disabled={loading}
                    className="mt-8 w-full rounded-xl bg-blue-600 py-4 text-lg font-semibold text-white transition hover:bg-blue-700 disabled:bg-gray-400"
                >

                    {loading
                        ? "Tworzenie konta..."
                        : "Utwórz konto"}

                </button>

                <p className="mt-6 text-center text-sm text-slate-500">

                    Masz już konto?{" "}

                    <Link
                        href="/login"
                        className="font-semibold text-blue-600 hover:text-blue-700"
                    >
                        Zaloguj się
                    </Link>

                </p>

            </form>

        </main>

    );

}