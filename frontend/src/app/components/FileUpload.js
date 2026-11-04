"use client";

import { useRef, useState } from "react";
import {
    UploadCloud,
    FileText,
    AudioLines,
    Sparkles,
    ArrowUp
} from "lucide-react";

import { motion } from "framer-motion";

import ReportViewer from "./ReportViewer";
import { parseAnalysisUploadResponse } from "@/lib/analysisUploadPayload";
import { validateAnalysisUploadFile } from "@/lib/analysisUploadKind";

import {
    uploadDocument,
    uploadMeeting
} from "@/lib/api";

export default function FileUpload({ mode = "document" }) {

    const inputRef = useRef(null);

    const [file, setFile] = useState(null);

    const [dragging, setDragging] = useState(false);

    const [loading, setLoading] = useState(false);

    const [report, setReport] = useState(null);

    const [filename, setFilename] = useState("");

    function selectFile(selected) {

        if (!selected || loading) {

            return;

        }

        try {

            const kind = validateAnalysisUploadFile(selected);
            if (kind !== mode) throw new Error(mode === "meeting" ? "Wybierz nagranie audio lub wideo." : "Wybierz plik PDF, DOCX lub TXT.");
            setFile(selected);

        } catch (err) {

            setFile(null);
            alert(err.message);

        }

    }

    async function analyze() {

        if (!file) {

            return;

        }

        setLoading(true);

        try {

            const formData = new FormData();

            formData.append("file", file);

            const kind = validateAnalysisUploadFile(file);

            const data = kind === "meeting"
                ? await uploadMeeting(formData)
                : await uploadDocument(formData);

            const analysis = parseAnalysisUploadResponse(data, file.name);

            setFilename(analysis.filename);

            setReport(analysis.report);

        }
        catch (err) {

            alert(err.message);

        }
        finally {

            setLoading(false);

        }

    }

    if (report) {

        return (

            <ReportViewer
                filename={filename}
                report={report}
                onBack={() => {

                    setReport(null);

                    setFile(null);

                }}
            />

        );

    }

    return (

        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-3xl border border-white/10 bg-gradient-to-br from-[#14274c] to-[#0b152c] p-5 shadow-xl sm:p-10"
        >

            <div className="flex items-center justify-between">

                <div>

                    <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-cyan-400/25 bg-cyan-400/10 px-4 py-2 text-xs font-bold text-cyan-200">

                        <Sparkles size={16} />

                        {mode === "meeting" ? "MEETING ANALYSIS" : "DOCUMENT ANALYSIS"}

                    </div>

                    <h2 className="text-2xl font-bold text-white sm:text-3xl">

                        {mode === "meeting" ? "Prześlij nagranie" : "Prześlij dokument"}

                    </h2>

                    <p className="mt-3 max-w-xl text-slate-300">

                        {mode === "meeting"
                          ? "Prześlij nagranie, aby uzyskać podsumowanie spotkania i zapisać wynik w historii."
                          : "Prześlij PDF, DOCX lub TXT. PrzemAI przygotuje podsumowanie i zapisze analizę w historii."}

                    </p>

                </div>

            </div>

            <div

                onDragOver={(e) => {

                    e.preventDefault();

                    setDragging(true);

                }}

                onDragLeave={() => {

                    setDragging(false);

                }}

                onDrop={(e) => {

                    e.preventDefault();

                    setDragging(false);

                    selectFile(

                        e.dataTransfer.files[0]

                    );

                }}

                onClick={() => inputRef.current.click()}

                className={`mt-7 cursor-pointer rounded-2xl border-2 border-dashed p-6 transition-all duration-300 sm:p-12 ${
                    dragging
                        ? "border-cyan-300 bg-cyan-300/10"
                        : "border-white/20 bg-white/[.04] hover:border-cyan-400/50 hover:bg-white/[.07]"
                }`}

            >

                <div className="flex flex-col items-center">

                    <div className="flex h-20 w-20 items-center justify-center rounded-2xl border border-cyan-400/25 bg-cyan-400/10 text-cyan-200">

                        <UploadCloud size={42} />

                    </div>

                    <h3 className="mt-6 text-xl font-bold text-white sm:text-2xl">

                        Przeciągnij plik tutaj

                    </h3>

                    <p className="mt-3 text-sm text-slate-300">

                        {mode === "meeting" ? "MP3 · WAV · M4A · OGG · WEBM · MP4" : "PDF · DOCX · TXT"}

                    </p>

                    <button
                        type="button"
                        className="mt-7 flex items-center gap-3 rounded-xl bg-cyan-400 px-6 py-3 text-sm font-bold text-slate-950 hover:bg-cyan-300"
                    >

                        <ArrowUp size={20} />

                        Wybierz plik

                    </button>

                </div>

            </div>

            <input
                hidden
                ref={inputRef}
                type="file"
                accept={mode === "meeting" ? ".mp3,.wav,.m4a,.ogg,.webm,.mpeg,.mp4" : ".pdf,.docx,.txt"}
                onChange={(e) => {

                    selectFile(e.target.files?.[0]);
                    e.target.value = "";

                }}
            />

            {file && (

                <div className="mt-7 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/[.06] p-5">

                    <div className="flex items-center gap-5">

                        <div className="rounded-xl bg-cyan-400/10 p-3 text-cyan-200">

                            {file.type.startsWith("audio")

                                ? <AudioLines size={30} />

                                : <FileText size={30} />

                            }

                        </div>

                        <div>

                            <h3 className="break-all font-semibold text-white">

                                {file.name}

                            </h3>

                            <p className="text-sm text-slate-300">

                                {(file.size / 1024 / 1024).toFixed(2)} MB

                            </p>

                        </div>

                    </div>

                    <button

                        disabled={loading}

                        onClick={analyze}

                        className="rounded-xl bg-cyan-400 px-6 py-3 font-bold text-slate-950 hover:bg-cyan-300 disabled:opacity-50"

                    >

                        {

                            loading

                                ? "Analizuję..."

                                : "Analizuj"

                        }

                    </button>

                </div>

            )}

        </motion.div>

    );

}