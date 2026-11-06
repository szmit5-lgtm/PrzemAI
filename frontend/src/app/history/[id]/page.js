"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import Navbar from "../../components/Navbar";
import UserMenu from "../../components/UserMenu";

import { getHistoryItem } from "@/lib/api";
import { parseHistoryDetailResponse } from "@/lib/historyDashboardPayload";

export default function HistoryDetailsPage() {

    const { id } = useParams();

    const router = useRouter();

    const [item, setItem] = useState(null);

    const [loading, setLoading] = useState(true);

    useEffect(() => {

        async function load() {

            try {

                const data = await getHistoryItem(id);

                setItem(parseHistoryDetailResponse(data));

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

        <main className="min-h-screen min-w-0 overflow-x-clip bg-[#080e20] text-slate-100">

            <div className="mx-auto w-full min-w-0 max-w-7xl px-3 py-5 sm:px-6 lg:px-8">

                <UserMenu />

                <Navbar />

                {loading && (

                    <div className="rounded-3xl border border-white/10 bg-[#111c35] p-8 shadow-sm sm:p-16">

                        Ładowanie...

                    </div>

                )}

                {!loading && item && (

                    <>

                        <div className="rounded-3xl border border-white/10 bg-[#111c35] p-5 shadow-sm sm:p-10">

                            <div className="flex items-center justify-between">

                                <div>

                                    <h1 className="text-3xl font-bold">

                                        {item.title}

                                    </h1>

                                    <p className="mt-2 text-slate-400">

                                        {item.type}

                                    </p>

                                </div>

                                <button
                                    onClick={() => router.push("/history")}
                                    className="rounded-xl border border-white/20 px-5 py-3 hover:bg-white/10"
                                >

                                    Powrót

                                </button>

                            </div>

                        </div>

                        <div className="mt-6 rounded-3xl border border-white/10 bg-[#111c35] p-5 shadow-sm sm:p-10">

                            <h2 className="mb-6 text-2xl font-bold">

                                Raport AI

                            </h2>

                            <pre className="max-w-full overflow-auto rounded-2xl bg-[#0a162b] p-4 text-sm leading-7 text-slate-200 sm:p-6">

{JSON.stringify(item.report, null, 2)}

                            </pre>

                        </div>

                    </>

                )}

            </div>

        </main>

    );

}