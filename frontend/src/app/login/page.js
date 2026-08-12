"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { login } from "@/lib/api";

export default function LoginPage() {

    const router = useRouter();

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");

    const [loading, setLoading] = useState(false);

    async function handleSubmit(e) {

        e.preventDefault();

        setLoading(true);

        try {

            const data = await login(

                email,
                password

            );

            localStorage.setItem(

                "token",
                data.token

            );

            router.push("/");

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

                        PrzemAI

                    </h1>

                    <p className="mt-2 text-slate-500">

                        Executive AI Assistant

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
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full rounded-xl border px-4 py-4 outline-none focus:ring-2 focus:ring-blue-500"
                    />

                </div>

                <button
                    type="submit"
                    disabled={loading}
                    className="mt-8 w-full rounded-xl bg-blue-600 py-4 text-lg font-semibold text-white transition hover:bg-blue-700 disabled:bg-gray-400"
                >

                    {loading
                        ? "Logowanie..."
                        : "Zaloguj się"}

                </button>

            </form>

        </main>

    );

}