"use client";

import { useEffect, useRef, useState } from "react";
import {
    MessageSquarePlus,
    MessageSquare,
    Trash2,
    Send,
    LoaderCircle
} from "lucide-react";

import Navbar from "../components/Navbar";
import UserMenu from "../components/UserMenu";

import {
    sendChatMessage,
    getConversations,
    getConversation,
    deleteConversation
} from "@/lib/api";

const welcomeMessage = {
    role: "assistant",
    content:
        "Cześć! Jestem PrzemAI Executive Copilot.\n\nMogę odpowiadać na pytania dotyczące dokumentów, spotkań, historii analiz i zadań.\n\nW czym mogę pomóc?"
};

export default function ChatPage() {

    const [conversations, setConversations] = useState([]);

    const [
        activeConversationId,
        setActiveConversationId
    ] = useState(null);

    const [messages, setMessages] = useState([
        welcomeMessage
    ]);

    const [message, setMessage] = useState("");

    const [loading, setLoading] = useState(false);
    const [loadingConversations, setLoadingConversations] =
        useState(true);
    const [loadingConversation, setLoadingConversation] =
        useState(false);

    const messagesEndRef = useRef(null);

    useEffect(() => {

        loadConversations();

    }, []);

    useEffect(() => {

        messagesEndRef.current?.scrollIntoView({
            behavior: "smooth"
        });

    }, [messages, loading]);

    async function loadConversations() {

        try {

            const data = await getConversations();

            setConversations(
                data.conversations || []
            );

        }
        catch (err) {

            alert(err.message);

        }
        finally {

            setLoadingConversations(false);

        }

    }

    async function openConversation(id) {

        if (
            loading ||
            loadingConversation ||
            id === activeConversationId
        ) {

            return;

        }

        setLoadingConversation(true);

        try {

            const data = await getConversation(id);

            const conversation = data.conversation;

            setActiveConversationId(conversation.id);

            setMessages(
                conversation.messages?.length
                    ? conversation.messages.map(item => ({
                        id: item.id,
                        role: item.role,
                        content: item.content
                    }))
                    : [welcomeMessage]
            );

        }
        catch (err) {

            alert(err.message);

        }
        finally {

            setLoadingConversation(false);

        }

    }

    function startNewConversation() {

        if (loading) {

            return;

        }

        setActiveConversationId(null);
        setMessages([welcomeMessage]);
        setMessage("");

    }

    async function archiveConversation(event, id) {

        event.preventDefault();
        event.stopPropagation();

        if (!confirm("Usunąć tę rozmowę?")) {

            return;

        }

        try {

            await deleteConversation(id);

            setConversations(current =>
                current.filter(item => item.id !== id)
            );

            if (activeConversationId === id) {

                startNewConversation();

            }

        }
        catch (err) {

            alert(err.message);

        }

    }

    async function send() {

        const text = message.trim();

        if (!text || loading) {

            return;

        }

        const temporaryUserMessage = {
            id: `temporary-${Date.now()}`,
            role: "user",
            content: text
        };

        setMessages(current => [
            ...current,
            temporaryUserMessage
        ]);

        setMessage("");
        setLoading(true);

        try {

            const data = await sendChatMessage(
                text,
                activeConversationId
            );

            setActiveConversationId(
                data.conversationId
            );

            setMessages(current => [
                ...current,
                {
                    id:
                        data.message?.id ||
                        `assistant-${Date.now()}`,
                    role: "assistant",
                    content: data.answer
                }
            ]);

            await loadConversations();

        }
        catch (err) {

            setMessages(current => [
                ...current,
                {
                    id: `error-${Date.now()}`,
                    role: "assistant",
                    content: `❌ ${err.message}`
                }
            ]);

        }
        finally {

            setLoading(false);

        }

    }

    function handleKeyDown(event) {

        if (
            event.key === "Enter" &&
            !event.shiftKey
        ) {

            event.preventDefault();

            send();

        }

    }

    return (

        <main className="min-h-screen bg-slate-100">

            <div className="mx-auto max-w-7xl p-8">

                <UserMenu />

                <Navbar />

                <div className="grid min-h-[720px] overflow-hidden rounded-3xl bg-white shadow-xl lg:grid-cols-[320px_1fr]">

                    <aside className="flex min-h-[720px] flex-col border-r bg-slate-950 text-white">

                        <div className="border-b border-slate-800 p-5">

                            <button
                                type="button"
                                onClick={startNewConversation}
                                disabled={loading}
                                className="flex w-full items-center justify-center gap-3 rounded-2xl bg-blue-600 px-5 py-4 font-semibold transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                            >

                                <MessageSquarePlus size={20} />

                                Nowa rozmowa

                            </button>

                        </div>

                        <div className="flex-1 overflow-y-auto p-4">

                            {loadingConversations && (

                                <div className="flex items-center justify-center gap-3 py-10 text-slate-400">

                                    <LoaderCircle
                                        size={20}
                                        className="animate-spin"
                                    />

                                    Ładowanie rozmów...

                                </div>

                            )}

                            {!loadingConversations &&
                                conversations.length === 0 && (

                                <div className="px-4 py-10 text-center text-sm text-slate-400">

                                    Brak zapisanych rozmów.

                                </div>

                            )}

                            {!loadingConversations &&
                                conversations.length > 0 && (

                                <div className="space-y-2">

                                    {conversations.map(
                                        conversation => {

                                            const active =
                                                conversation.id ===
                                                activeConversationId;

                                            return (

                                                <button
                                                    type="button"
                                                    key={conversation.id}
                                                    onClick={() =>
                                                        openConversation(
                                                            conversation.id
                                                        )
                                                    }
                                                    className={`group flex w-full items-center gap-3 rounded-xl px-4 py-4 text-left transition ${
                                                        active
                                                            ? "bg-blue-600"
                                                            : "hover:bg-slate-800"
                                                    }`}
                                                >

                                                    <MessageSquare
                                                        size={18}
                                                        className="shrink-0"
                                                    />

                                                    <div className="min-w-0 flex-1">

                                                        <div className="truncate font-medium">

                                                            {
                                                                conversation.title
                                                            }

                                                        </div>

                                                        <div className={`mt-1 text-xs ${
                                                            active
                                                                ? "text-blue-100"
                                                                : "text-slate-400"
                                                        }`}>

                                                            {
                                                                conversation
                                                                    ._count
                                                                    ?.messages ||
                                                                0
                                                            }{" "}
                                                            wiadomości

                                                        </div>

                                                    </div>

                                                    <span
                                                        role="button"
                                                        tabIndex={0}
                                                        onClick={event =>
                                                            archiveConversation(
                                                                event,
                                                                conversation.id
                                                            )
                                                        }
                                                        onKeyDown={event => {

                                                            if (
                                                                event.key ===
                                                                    "Enter" ||
                                                                event.key ===
                                                                    " "
                                                            ) {

                                                                archiveConversation(
                                                                    event,
                                                                    conversation.id
                                                                );

                                                            }

                                                        }}
                                                        className="rounded-lg p-2 text-slate-400 opacity-0 transition hover:bg-red-500/20 hover:text-red-300 group-hover:opacity-100"
                                                        aria-label="Usuń rozmowę"
                                                    >

                                                        <Trash2 size={17} />

                                                    </span>

                                                </button>

                                            );

                                        }
                                    )}

                                </div>

                            )}

                        </div>

                    </aside>

                    <section className="flex min-h-[720px] min-w-0 flex-col">

                        <header className="border-b px-8 py-6">

                            <h1 className="text-3xl font-bold">

                                🧠 Executive Copilot

                            </h1>

                            <p className="mt-2 text-slate-500">

                                Rozmawiaj z PrzemAI o dokumentach,
                                spotkaniach, historii i zadaniach.

                            </p>

                        </header>

                        <div className="flex-1 overflow-y-auto p-8">

                            {loadingConversation ? (

                                <div className="flex h-full items-center justify-center gap-3 text-slate-500">

                                    <LoaderCircle
                                        size={24}
                                        className="animate-spin"
                                    />

                                    Ładowanie rozmowy...

                                </div>

                            ) : (

                                <div className="space-y-6">

                                    {messages.map((item, index) => (

                                        <div
                                            key={
                                                item.id ||
                                                `${item.role}-${index}`
                                            }
                                            className={`flex ${
                                                item.role === "user"
                                                    ? "justify-end"
                                                    : "justify-start"
                                            }`}
                                        >

                                            <div
                                                className={`max-w-3xl whitespace-pre-wrap rounded-2xl px-6 py-4 leading-7 ${
                                                    item.role === "user"
                                                        ? "bg-blue-600 text-white"
                                                        : "bg-slate-100 text-slate-800"
                                                }`}
                                            >

                                                {item.content}

                                            </div>

                                        </div>

                                    ))}

                                    {loading && (

                                        <div className="flex justify-start">

                                            <div className="flex items-center gap-3 rounded-2xl bg-slate-100 px-6 py-4 text-slate-500">

                                                <LoaderCircle
                                                    size={19}
                                                    className="animate-spin"
                                                />

                                                PrzemAI analizuje...

                                            </div>

                                        </div>

                                    )}

                                    <div ref={messagesEndRef} />

                                </div>

                            )}

                        </div>

                        <div className="border-t p-6">

                            <textarea
                                rows={3}
                                value={message}
                                disabled={
                                    loading ||
                                    loadingConversation
                                }
                                onChange={event =>
                                    setMessage(
                                        event.target.value
                                    )
                                }
                                onKeyDown={handleKeyDown}
                                placeholder="Napisz wiadomość... Enter wysyła, Shift+Enter dodaje nową linię."
                                className="w-full resize-none rounded-2xl border px-5 py-4 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:bg-slate-100"
                            />

                            <div className="mt-4 flex items-center justify-between gap-4">

                                <p className="text-sm text-slate-400">

                                    PrzemAI może korzystać z zapisanych
                                    zadań, dokumentów i spotkań.

                                </p>

                                <button
                                    type="button"
                                    onClick={send}
                                    disabled={
                                        loading ||
                                        loadingConversation ||
                                        !message.trim()
                                    }
                                    className="flex items-center gap-3 rounded-2xl bg-blue-600 px-8 py-4 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-400"
                                >

                                    {loading ? (

                                        <LoaderCircle
                                            size={19}
                                            className="animate-spin"
                                        />

                                    ) : (

                                        <Send size={19} />

                                    )}

                                    {loading
                                        ? "Wysyłanie..."
                                        : "Wyślij"}

                                </button>

                            </div>

                        </div>

                    </section>

                </div>

            </div>

        </main>

    );

}