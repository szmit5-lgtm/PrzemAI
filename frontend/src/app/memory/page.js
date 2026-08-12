"use client";

import { useEffect, useMemo, useState } from "react";
import Navbar from "../components/Navbar";
import UserMenu from "../components/UserMenu";

import {
    Brain,
    Building2,
    UserRound,
    FolderKanban,
    Star,
    Archive,
    RefreshCw,
    Search,
    Plus,
    Pencil,
    X,
    Save
} from "lucide-react";

import {
    getMemories,
    createMemory,
    updateMemory,
    archiveMemory
} from "../../lib/api";

const EMPTY_FORM = {
    type: "OTHER",
    title: "",
    content: "",
    importance: 3,
    tags: ""
};

const MEMORY_TYPES = [
    "CLIENT",
    "COMPANY",
    "PROJECT",
    "PERSON",
    "DECISION",
    "AGREEMENT",
    "PREFERENCE",
    "DEADLINE",
    "BUSINESS",
    "FACT",
    "OTHER"
];

export default function MemoryPage() {

    const [memories, setMemories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const [query, setQuery] = useState("");
    const [type, setType] = useState("ALL");

    const [archivingId, setArchivingId] = useState(null);

    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [saving, setSaving] = useState(false);

    const [form, setForm] = useState(
        EMPTY_FORM
    );

    useEffect(() => {

        loadMemories();

    }, []);

    async function loadMemories() {

        try {

            setLoading(true);
            setError("");

            const response =
                await getMemories();

            setMemories(
                Array.isArray(response)
                    ? response
                    : response.memories || []
            );

        }
        catch (err) {

            setError(
                err.message ||
                "Nie udało się pobrać pamięci AI."
            );

        }
        finally {

            setLoading(false);

        }

    }

    function openCreateForm() {

        setEditingId(null);

        setForm({
            ...EMPTY_FORM
        });

        setShowForm(true);
        setError("");

    }

    function openEditForm(memory) {

        setEditingId(memory.id);

        setForm({

            type:
                memory.type ||
                "OTHER",

            title:
                memory.title ||
                "",

            content:
                memory.content ||
                "",

            importance:
                memory.importance ||
                3,

            tags:
                Array.isArray(memory.tags)
                    ? memory.tags.join(", ")
                    : ""

        });

        setShowForm(true);
        setError("");

    }

    function closeForm() {

        setShowForm(false);
        setEditingId(null);

        setForm({
            ...EMPTY_FORM
        });

    }

    function updateForm(field, value) {

        setForm(current => ({

            ...current,
            [field]: value

        }));

    }

    function parseTags(value) {

        return Array.from(
            new Set(
                value
                    .split(",")
                    .map(tag => tag.trim())
                    .filter(Boolean)
            )
        );

    }

    async function handleSave(event) {

        event.preventDefault();

        try {

            setSaving(true);
            setError("");

            if (!form.title.trim()) {

                throw new Error(
                    "Podaj tytuł pamięci."
                );

            }

            if (!form.content.trim()) {

                throw new Error(
                    "Podaj treść pamięci."
                );

            }

            const payload = {

                type: form.type,

                title:
                    form.title.trim(),

                content:
                    form.content.trim(),

                importance:
                    Number(form.importance),

                tags:
                    parseTags(form.tags)

            };

            if (editingId) {

                await updateMemory(
                    editingId,
                    payload
                );

            }
            else {

                await createMemory(
                    payload
                );

            }

            closeForm();

            await loadMemories();

        }
        catch (err) {

            setError(
                err.message ||
                "Nie udało się zapisać pamięci."
            );

        }
        finally {

            setSaving(false);

        }

    }

    async function handleArchive(id) {

        try {

            setArchivingId(id);
            setError("");

            await archiveMemory(id);

            setMemories(current =>
                current.filter(
                    memory =>
                        memory.id !== id
                )
            );

        }
        catch (err) {

            setError(
                err.message ||
                "Nie udało się zarchiwizować wpisu."
            );

        }
        finally {

            setArchivingId(null);

        }

    }

    const types = useMemo(() => {

        const uniqueTypes =
            Array.from(
                new Set(
                    memories
                        .map(
                            memory =>
                                memory.type
                        )
                        .filter(Boolean)
                )
            );

        return uniqueTypes.sort();

    }, [memories]);

    const filteredMemories =
        useMemo(() => {

            const normalizedQuery =
                query
                    .trim()
                    .toLowerCase();

            return memories.filter(
                memory => {

                    if (
                        type !== "ALL" &&
                        memory.type !== type
                    ) {

                        return false;

                    }

                    if (!normalizedQuery) {

                        return true;

                    }

                    const searchable = [

                        memory.title,
                        memory.content,
                        memory.type,

                        ...(
                            Array.isArray(
                                memory.tags
                            )
                                ? memory.tags
                                : []
                        )

                    ]
                        .filter(Boolean)
                        .join(" ")
                        .toLowerCase();

                    return searchable.includes(
                        normalizedQuery
                    );

                }
            );

        }, [
            memories,
            query,
            type
        ]);

    function getTypeIcon(memoryType) {

        switch (memoryType) {

            case "CLIENT":

                return (
                    <UserRound size={20} />
                );

            case "COMPANY":
            case "BUSINESS":

                return (
                    <Building2 size={20} />
                );

            case "PROJECT":

                return (
                    <FolderKanban size={20} />
                );

            case "PREFERENCE":

                return (
                    <Star size={20} />
                );

            default:

                return (
                    <Brain size={20} />
                );

        }

    }

    function formatDate(value) {

        if (!value) {

            return "-";

        }

        return new Date(
            value
        ).toLocaleString(
            "pl-PL"
        );

    }

    return (

        <main className="min-h-screen bg-slate-100">

            <div className="mx-auto max-w-7xl p-8">

                <UserMenu />

                <Navbar />

                <div className="rounded-3xl border bg-white p-8 shadow-sm">

                    <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">

                        <div>

                            <div className="flex items-center gap-3">

                                <Brain className="text-slate-700" />

                                <h1 className="text-3xl font-bold">

                                    Pamięć AI

                                </h1>

                            </div>

                            <p className="mt-3 text-slate-500">

                                Trwała wiedza zapamiętana przez PrzemAI
                                oraz informacje dodane ręcznie.

                            </p>

                        </div>

                        <div className="flex flex-wrap gap-3">

                            <button
                                onClick={loadMemories}
                                disabled={loading}
                                className="flex items-center justify-center gap-2 rounded-xl border px-4 py-3 font-medium hover:bg-slate-50 disabled:opacity-50"
                            >

                                <RefreshCw
                                    size={18}
                                    className={
                                        loading
                                            ? "animate-spin"
                                            : ""
                                    }
                                />

                                Odśwież

                            </button>

                            <button
                                onClick={openCreateForm}
                                className="flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 font-medium text-white hover:bg-blue-700"
                            >

                                <Plus size={18} />

                                Dodaj pamięć

                            </button>

                        </div>

                    </div>

                    {showForm && (

                        <form
                            onSubmit={handleSave}
                            className="mt-8 rounded-2xl border bg-slate-50 p-6"
                        >

                            <div className="flex items-center justify-between">

                                <h2 className="text-xl font-semibold">

                                    {editingId
                                        ? "Edytuj pamięć"
                                        : "Dodaj pamięć"}

                                </h2>

                                <button
                                    type="button"
                                    onClick={closeForm}
                                    className="rounded-lg p-2 text-slate-500 hover:bg-slate-200"
                                >

                                    <X size={18} />

                                </button>

                            </div>

                            <div className="mt-6 grid gap-5 md:grid-cols-2">

                                <div>

                                    <label className="mb-2 block text-sm font-medium">

                                        Typ

                                    </label>

                                    <select
                                        value={form.type}
                                        onChange={event =>
                                            updateForm(
                                                "type",
                                                event.target.value
                                            )
                                        }
                                        className="w-full rounded-xl border bg-white px-4 py-3 outline-none"
                                    >

                                        {MEMORY_TYPES.map(
                                            item => (

                                                <option
                                                    key={item}
                                                    value={item}
                                                >

                                                    {item}

                                                </option>

                                            )
                                        )}

                                    </select>

                                </div>

                                <div>

                                    <label className="mb-2 block text-sm font-medium">

                                        Ważność

                                    </label>

                                    <select
                                        value={form.importance}
                                        onChange={event =>
                                            updateForm(
                                                "importance",
                                                event.target.value
                                            )
                                        }
                                        className="w-full rounded-xl border bg-white px-4 py-3 outline-none"
                                    >

                                        <option value="1">
                                            1 - niska
                                        </option>

                                        <option value="2">
                                            2
                                        </option>

                                        <option value="3">
                                            3 - normalna
                                        </option>

                                        <option value="4">
                                            4
                                        </option>

                                        <option value="5">
                                            5 - bardzo ważna
                                        </option>

                                    </select>

                                </div>

                            </div>

                            <div className="mt-5">

                                <label className="mb-2 block text-sm font-medium">

                                    Tytuł

                                </label>

                                <input
                                    value={form.title}
                                    onChange={event =>
                                        updateForm(
                                            "title",
                                            event.target.value
                                        )
                                    }
                                    placeholder="Np. Klient ABC"
                                    className="w-full rounded-xl border bg-white px-4 py-3 outline-none focus:ring-2 focus:ring-blue-100"
                                />

                            </div>

                            <div className="mt-5">

                                <label className="mb-2 block text-sm font-medium">

                                    Treść

                                </label>

                                <textarea
                                    value={form.content}
                                    onChange={event =>
                                        updateForm(
                                            "content",
                                            event.target.value
                                        )
                                    }
                                    placeholder="Informacja, którą PrzemAI ma pamiętać..."
                                    rows={5}
                                    className="w-full resize-none rounded-xl border bg-white px-4 py-3 outline-none focus:ring-2 focus:ring-blue-100"
                                />

                            </div>

                            <div className="mt-5">

                                <label className="mb-2 block text-sm font-medium">

                                    Tagi

                                </label>

                                <input
                                    value={form.tags}
                                    onChange={event =>
                                        updateForm(
                                            "tags",
                                            event.target.value
                                        )
                                    }
                                    placeholder="Np. ABC, Microsoft 365, klient"
                                    className="w-full rounded-xl border bg-white px-4 py-3 outline-none focus:ring-2 focus:ring-blue-100"
                                />

                                <p className="mt-2 text-xs text-slate-400">

                                    Oddziel tagi przecinkami.

                                </p>

                            </div>

                            <div className="mt-6 flex justify-end gap-3">

                                <button
                                    type="button"
                                    onClick={closeForm}
                                    className="rounded-xl border px-5 py-3 font-medium hover:bg-white"
                                >

                                    Anuluj

                                </button>

                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-3 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                                >

                                    <Save size={18} />

                                    {saving
                                        ? "Zapisywanie..."
                                        : "Zapisz"}

                                </button>

                            </div>

                        </form>

                    )}

                    <div className="mt-8 grid gap-4 md:grid-cols-[1fr_220px]">

                        <div className="relative">

                            <Search
                                size={18}
                                className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                            />

                            <input
                                value={query}
                                onChange={event =>
                                    setQuery(
                                        event.target.value
                                    )
                                }
                                placeholder="Szukaj w pamięci..."
                                className="w-full rounded-xl border bg-white py-3 pl-11 pr-4 outline-none focus:ring-2 focus:ring-slate-200"
                            />

                        </div>

                        <select
                            value={type}
                            onChange={event =>
                                setType(
                                    event.target.value
                                )
                            }
                            className="rounded-xl border bg-white px-4 py-3 outline-none"
                        >

                            <option value="ALL">

                                Wszystkie typy

                            </option>

                            {types.map(item => (

                                <option
                                    key={item}
                                    value={item}
                                >

                                    {item}

                                </option>

                            ))}

                        </select>

                    </div>

                    {error && (

                        <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">

                            {error}

                        </div>

                    )}

                    <div className="mt-8">

                        {loading ? (

                            <div className="rounded-2xl border p-10 text-center text-slate-500">

                                Ładowanie pamięci...

                            </div>

                        ) : filteredMemories.length === 0 ? (

                            <div className="rounded-2xl border p-10 text-center text-slate-500">

                                Brak zapisanych wspomnień.

                            </div>

                        ) : (

                            <div className="grid gap-5 md:grid-cols-2">

                                {filteredMemories.map(
                                    memory => (

                                        <div
                                            key={memory.id}
                                            className="rounded-2xl border bg-white p-6"
                                        >

                                            <div className="flex items-start justify-between gap-4">

                                                <div className="flex min-w-0 items-start gap-3">

                                                    <div className="rounded-xl bg-slate-100 p-2 text-slate-700">

                                                        {getTypeIcon(
                                                            memory.type
                                                        )}

                                                    </div>

                                                    <div className="min-w-0">

                                                        <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">

                                                            {memory.type}

                                                        </div>

                                                        <h2 className="mt-1 break-words text-lg font-semibold">

                                                            {memory.title}

                                                        </h2>

                                                    </div>

                                                </div>

                                                <div className="flex gap-1">

                                                    <button
                                                        onClick={() =>
                                                            openEditForm(
                                                                memory
                                                            )
                                                        }
                                                        title="Edytuj"
                                                        className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-blue-600"
                                                    >

                                                        <Pencil size={18} />

                                                    </button>

                                                    <button
                                                        onClick={() =>
                                                            handleArchive(
                                                                memory.id
                                                            )
                                                        }
                                                        disabled={
                                                            archivingId ===
                                                            memory.id
                                                        }
                                                        title="Archiwizuj"
                                                        className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-red-600 disabled:opacity-50"
                                                    >

                                                        <Archive size={18} />

                                                    </button>

                                                </div>

                                            </div>

                                            <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-slate-600">

                                                {memory.content}

                                            </p>

                                            {Array.isArray(
                                                memory.tags
                                            ) &&
                                                memory.tags.length > 0 && (

                                                    <div className="mt-5 flex flex-wrap gap-2">

                                                        {memory.tags.map(
                                                            tag => (

                                                                <span
                                                                    key={tag}
                                                                    className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600"
                                                                >

                                                                    {tag}

                                                                </span>

                                                            )
                                                        )}

                                                    </div>

                                                )}

                                            <div className="mt-5 grid gap-2 border-t pt-4 text-xs text-slate-400 sm:grid-cols-3">

                                                <div>

                                                    Źródło:{" "}

                                                    <span className="font-medium text-slate-600">

                                                        {memory.source}

                                                    </span>

                                                </div>

                                                <div>

                                                    Ważność:{" "}

                                                    <span className="font-medium text-slate-600">

                                                        {memory.importance}/5

                                                    </span>

                                                </div>

                                                <div>

                                                    Aktualizacja:{" "}

                                                    <span className="font-medium text-slate-600">

                                                        {formatDate(
                                                            memory.updatedAt
                                                        )}

                                                    </span>

                                                </div>

                                            </div>

                                        </div>

                                    )
                                )}

                            </div>

                        )}

                    </div>

                </div>

            </div>

        </main>

    );

}