"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import Navbar from "../../components/Navbar";
import UserMenu from "../../components/UserMenu";

import { getHistoryItem } from "@/lib/api";

export default function HistoryDetailsPage() {

    const { id } = useParams();

    const router = useRouter();

    const [item, setItem] = useState(null);

    const [loading, setLoading] = useState(true);

    useEffect(() => {

        async function load() {

            try {

                const data = await getHistoryItem(id);

                setItem(data.item);

            }
            catch (err) {

                alert(err.message);

                router.push("/history");

            }
            finally {

                setLoading(false);

            }

        }

        if (id) {

            load();

        }

    }, [id, router]);

    return (

        <main className="min-h-screen bg-slate-100">

            <div className="mx-auto max-w-7xl p-8">

                <UserMenu />

                <Navbar />

                {loading && (

                    <div className="rounded-3xl bg-white p-16 shadow-sm">

                        Ładowanie...

                    </div>

                )}

                {!loading && item && (

                    <>

                        <div className="rounded-3xl bg-white p-10 shadow-sm">

                            <div className="flex items-center justify-between">

                                <div>

                                    <h1 className="text-3xl font-bold">

                                        {item.title}

                                    </h1>

                                    <p className="mt-2 text-slate-500">

                                        {item.type}

                                    </p>

                                </div>

                                <button
                                    onClick={() => router.push("/history")}
                                    className="rounded-xl border px-5 py-3 hover:bg-slate-50"
                                >

                                    Powrót

                                </button>

                            </div>

                        </div>

                        <div className="mt-6 rounded-3xl bg-white p-10 shadow-sm">

                            <h2 className="mb-6 text-2xl font-bold">

                                Raport AI

                            </h2>

                            <pre className="overflow-auto rounded-2xl bg-slate-50 p-6 text-sm leading-7">

{JSON.stringify(item.report, null, 2)}

                            </pre>

                        </div>

                    </>

                )}

            </div>

        </main>

    );

}