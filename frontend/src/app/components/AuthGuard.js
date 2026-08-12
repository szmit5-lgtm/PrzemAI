"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { getProfile } from "@/lib/api";

export default function AuthGuard({ children }) {

    const router = useRouter();

    const pathname = usePathname();

    const [loading, setLoading] = useState(true);

    useEffect(() => {

        if (pathname === "/login") {

            setLoading(false);

            return;

        }

        async function verify() {

            try {

                await getProfile();

                setLoading(false);

            }
            catch {

                localStorage.removeItem("token");

                router.replace("/login");

            }

        }

        verify();

    }, [pathname, router]);

    if (loading) {

        return (

            <div className="min-h-screen flex items-center justify-center">

                <div className="text-center">

                    <div className="text-5xl mb-4">

                        🧠

                    </div>

                    <div className="text-xl font-semibold">

                        Sprawdzanie sesji...

                    </div>

                </div>

            </div>

        );

    }

    return children;

}