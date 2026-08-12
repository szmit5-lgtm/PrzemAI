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

import {
    uploadDocument,
    uploadMeeting
} from "@/lib/api";

export default function FileUpload() {

    const inputRef = useRef(null);

    const [file, setFile] = useState(null);

    const [dragging, setDragging] = useState(false);

    const [loading, setLoading] = useState(false);

    const [report, setReport] = useState(null);

    const [filename, setFilename] = useState("");

    function selectFile(selected) {

        if (!selected) {

            return;

        }

        setFile(selected);

    }

    async function analyze() {

        if (!file) {

            return;

        }

        setLoading(true);

        try {

            const formData = new FormData();

            formData.append("file", file);

            const extension = file.name
                .split(".")
                .pop()
                .toLowerCase();

            const audio = [
                "mp3",
                "wav",
                "m4a",
                "ogg",
                "webm",
                "mpeg",
                "mp4"
            ];

            const data = audio.includes(extension)
                ? await uploadMeeting(formData)
                : await uploadDocument(formData);

            setFilename(data.filename);

            setReport(data.report);

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
            className="glass p-10"
        >

            <div className="flex items-center justify-between">

                <div>

                    <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-blue-100 px-4 py-2 text-sm font-semibold text-blue-700">

                        <Sparkles size={16} />

                        AI Analysis

                    </div>

                    <h2 className="text-4xl font-bold">

                        Dodaj dokument

                    </h2>

                    <p className="mt-3 max-w-xl text-slate-500">

                        Przeciągnij plik lub kliknij poniżej.
                        PrzemAI automatycznie przeanalizuje dokument,
                        przygotuje executive summary oraz zapisze go
                        w historii.

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

                className={`mt-10 cursor-pointer rounded-3xl border-2 border-dashed p-16 transition-all duration-300 ${
                    dragging
                        ? "border-blue-600 bg-blue-50"
                        : "border-slate-300 bg-white hover:border-blue-500 hover:bg-slate-50"
                }`}

            >

                <div className="flex flex-col items-center">

                    <div className="flex h-24 w-24 items-center justify-center rounded-3xl bg-gradient-to-br from-blue-600 to-violet-600 text-white shadow-xl">

                        <UploadCloud size={42} />

                    </div>

                    <h3 className="mt-8 text-3xl font-bold">

                        Przeciągnij plik tutaj

                    </h3>

                    <p className="mt-3 text-slate-500">

                        PDF • DOCX • TXT • MP3 • WAV • MP4

                    </p>

                    <button
                        className="mt-10 flex items-center gap-3 rounded-2xl bg-gradient-to-r from-blue-600 to-violet-600 px-8 py-4 text-lg font-semibold text-white shadow-xl hover:scale-105"
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
                onChange={(e) => {

                    selectFile(

                        e.target.files?.[0]

                    );

                }}
            />

            {file && (

                <div className="mt-8 flex items-center justify-between rounded-3xl border bg-white p-6 shadow-sm">

                    <div className="flex items-center gap-5">

                        <div className="rounded-2xl bg-slate-100 p-4">

                            {file.type.startsWith("audio")

                                ? <AudioLines size={30} />

                                : <FileText size={30} />

                            }

                        </div>

                        <div>

                            <h3 className="font-semibold">

                                {file.name}

                            </h3>

                            <p className="text-sm text-slate-500">

                                {(file.size / 1024 / 1024).toFixed(2)} MB

                            </p>

                        </div>

                    </div>

                    <button

                        disabled={loading}

                        onClick={analyze}

                        className="rounded-2xl bg-gradient-to-r from-blue-600 to-violet-600 px-8 py-4 font-semibold text-white shadow-lg hover:scale-105"

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