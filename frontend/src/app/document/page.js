"use client";

import AuthGuard from "../components/AuthGuard";
import Navbar from "../components/Navbar";
import FileUpload from "../components/FileUpload";

export default function DocumentPage() {
    return (
        <AuthGuard>
            <main className="min-h-screen bg-slate-100">
                <Navbar />

                <div className="mx-auto max-w-7xl p-8">
                    <FileUpload />
                </div>
            </main>
        </AuthGuard>
    );
}