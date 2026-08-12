"use client";

import { useEffect, useState } from "react";

import Navbar from "../components/Navbar";
import UserMenu from "../components/UserMenu";

import {
    getTasks,
    createTask,
    deleteTask,
    completeTask
} from "@/lib/api";

export default function TasksPage() {

    const [tasks, setTasks] = useState([]);
    const [loading, setLoading] = useState(true);

    const [form, setForm] = useState({
        title: "",
        description: "",
        priority: "MEDIUM",
        dueDate: ""
    });

    async function loadTasks() {

        try {

            const data = await getTasks();

            setTasks(data.items || []);

        } catch (err) {

            alert(err.message);

        } finally {

            setLoading(false);

        }

    }

    useEffect(() => {

        loadTasks();

    }, []);

    async function submit(e) {

        e.preventDefault();

        try {

            const data = await createTask(form);

            setTasks(current => [
                data.item,
                ...current
            ]);

            setForm({
                title: "",
                description: "",
                priority: "MEDIUM",
                dueDate: ""
            });

        } catch (err) {

            alert(err.message);

        }

    }

    async function complete(id) {

        try {

            const data = await completeTask(id);

            setTasks(current =>
                current.map(task =>
                    task.id === id
                        ? data.item
                        : task
                )
            );

        } catch (err) {

            alert(err.message);

        }

    }

    async function remove(id) {

        if (!confirm("Usunąć zadanie?")) {

            return;

        }

        try {

            await deleteTask(id);

            setTasks(current =>
                current.filter(task => task.id !== id)
            );

        } catch (err) {

            alert(err.message);

        }

    }

    return (

        <main className="min-h-screen bg-slate-100">

            <div className="mx-auto max-w-7xl p-8">

                <UserMenu />

                <Navbar />

                <div className="rounded-3xl border bg-white p-10 shadow-sm">

                    <h1 className="text-3xl font-bold">

                        Zadania

                    </h1>

                    <form
                        onSubmit={submit}
                        className="mt-8 grid gap-4"
                    >

                        <input
                            className="rounded-xl border p-3"
                            placeholder="Tytuł"
                            value={form.title}
                            onChange={e =>
                                setForm({
                                    ...form,
                                    title: e.target.value
                                })
                            }
                            required
                        />

                        <textarea
                            className="rounded-xl border p-3"
                            placeholder="Opis"
                            rows={4}
                            value={form.description}
                            onChange={e =>
                                setForm({
                                    ...form,
                                    description: e.target.value
                                })
                            }
                        />

                        <div className="grid gap-4 md:grid-cols-2">

                            <select
                                className="rounded-xl border p-3"
                                value={form.priority}
                                onChange={e =>
                                    setForm({
                                        ...form,
                                        priority: e.target.value
                                    })
                                }
                            >

                                <option value="LOW">Niski</option>
                                <option value="MEDIUM">Średni</option>
                                <option value="HIGH">Wysoki</option>

                            </select>

                            <input
                                type="date"
                                className="rounded-xl border p-3"
                                value={form.dueDate}
                                onChange={e =>
                                    setForm({
                                        ...form,
                                        dueDate: e.target.value
                                    })
                                }
                            />

                        </div>

                        <button
                            className="rounded-xl bg-blue-600 py-3 font-semibold text-white hover:bg-blue-700"
                        >

                            Dodaj zadanie

                        </button>

                    </form>

                    {loading ? (

                        <div className="mt-8">

                            Ładowanie...

                        </div>

                    ) : (

                        <div className="mt-10 space-y-4">

                            {tasks.map(task => (

                                <div
                                    key={task.id}
                                    className={`rounded-2xl border p-6 ${
                                        task.status === "DONE"
                                            ? "bg-green-50 border-green-300"
                                            : "bg-white"
                                    }`}
                                >

                                    <div className="flex items-start justify-between">

                                        <div>

                                            <h2 className="text-xl font-semibold">

                                                {task.title}

                                            </h2>

                                            <p className="mt-2 text-slate-600">

                                                {task.description}

                                            </p>

                                            <p className="mt-2 text-sm text-slate-500">

                                                Priorytet: {task.priority}

                                            </p>

                                            <p className="mt-1 text-sm text-slate-500">

                                                Status: {task.status}

                                            </p>

                                        </div>

                                        <div className="flex gap-2">

                                            {task.status !== "DONE" && (

                                                <button
                                                    onClick={() => complete(task.id)}
                                                    className="rounded-xl bg-green-600 px-4 py-2 text-white hover:bg-green-700"
                                                >

                                                    Wykonane

                                                </button>

                                            )}

                                            <button
                                                onClick={() => remove(task.id)}
                                                className="rounded-xl border border-red-500 px-4 py-2 text-red-600 hover:bg-red-50"
                                            >

                                                Usuń

                                            </button>

                                        </div>

                                    </div>

                                </div>

                            ))}

                        </div>

                    )}

                </div>

            </div>

        </main>

    );

}