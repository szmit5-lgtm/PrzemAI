"use client";

import { useEffect, useState } from "react";

import Navbar from "../components/Navbar";
import UserMenu from "../components/UserMenu";

import {
    User,
    Bot,
    Shield,
    KeyRound,
    Save,
    RefreshCw,
    Brain,
    History,
    Gauge,
    Eye,
    EyeOff
} from "lucide-react";

import {
    parseProfileResponse,
    parseSettingsResponse,
    parsePasswordChangeResponse
} from "../../lib/settingsDashboardPayload";

import {
    getProfile,
    getSettings,
    updateSettings,
    changePassword
} from "../../lib/api";

export default function SettingsPage() {

    const [profile, setProfile] = useState(null);

    const [settings, setSettings] = useState({
        memoryEnabled: true,
        historyEnabled: true,
        executiveMode: true,
        aiModel: "gpt-5.5"
    });

    const [passwordForm, setPasswordForm] = useState({
        currentPassword: "",
        newPassword: "",
        confirmPassword: ""
    });

    const [showPasswords, setShowPasswords] = useState(false);

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [changingPassword, setChangingPassword] = useState(false);

    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    const [passwordError, setPasswordError] = useState("");
    const [passwordSuccess, setPasswordSuccess] = useState("");

    useEffect(() => {

        loadData();

    }, []);

    async function loadData() {

        try {

            setLoading(true);
            setError("");
            setSuccess("");

            const [
                profileResponse,
                settingsResponse
            ] = await Promise.all([

                getProfile(),
                getSettings()

            ]);

            setProfile(parseProfileResponse(profileResponse));
            setSettings(parseSettingsResponse(settingsResponse));

        }
        catch (err) {

            setError(
                err.message ||
                "Nie udało się pobrać ustawień."
            );

        }
        finally {

            setLoading(false);

        }

    }

    function toggleSetting(name) {

        setSettings(current => ({

            ...current,

            [name]: !current[name]

        }));

        setSuccess("");

    }

    async function handleSave() {

        try {

            setSaving(true);
            setError("");
            setSuccess("");

            const response =
                await updateSettings(
                    settings
                );

            setSettings(parseSettingsResponse(response, settings));

            setSuccess(
                "Ustawienia zostały zapisane."
            );

        }
        catch (err) {

            setError(
                err.message ||
                "Nie udało się zapisać ustawień."
            );

        }
        finally {

            setSaving(false);

        }

    }

    function updatePasswordField(
        name,
        value
    ) {

        setPasswordForm(current => ({

            ...current,

            [name]: value

        }));

        setPasswordError("");
        setPasswordSuccess("");

    }

    async function handleChangePassword(event) {

        event.preventDefault();

        try {

            setChangingPassword(true);
            setPasswordError("");
            setPasswordSuccess("");

            if (
                !passwordForm.currentPassword ||
                !passwordForm.newPassword ||
                !passwordForm.confirmPassword
            ) {

                throw new Error(
                    "Uzupełnij wszystkie pola hasła."
                );

            }

            if (
                passwordForm.newPassword.length < 8
            ) {

                throw new Error(
                    "Nowe hasło musi mieć co najmniej 8 znaków."
                );

            }

            if (
                passwordForm.newPassword !==
                passwordForm.confirmPassword
            ) {

                throw new Error(
                    "Nowe hasła nie są takie same."
                );

            }

            const passwordResponse = await changePassword(
                passwordForm.currentPassword,
                passwordForm.newPassword
            );
            parsePasswordChangeResponse(passwordResponse);

            setPasswordForm({
                currentPassword: "",
                newPassword: "",
                confirmPassword: ""
            });

            setPasswordSuccess(
                "Hasło zostało zmienione."
            );

        }
        catch (err) {

            setPasswordError(
                err.message ||
                "Nie udało się zmienić hasła."
            );

        }
        finally {

            setChangingPassword(false);

        }

    }

    return (

        <main className="min-h-screen min-w-0 overflow-x-clip bg-[#080e20] text-slate-100">

            <div className="mx-auto w-full min-w-0 max-w-7xl px-3 py-5 sm:px-6 lg:px-8">

                <UserMenu />

                <Navbar />

                <div className="min-w-0 overflow-hidden rounded-3xl border border-white/10 bg-[#111c35] p-4 shadow-sm sm:p-8">

                    <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">

                        <div>

                            <h1 className="text-3xl font-bold">

                                Ustawienia

                            </h1>

                            <p className="mt-3 text-slate-400">

                                Zarządzaj kontem oraz konfiguracją PrzemAI.

                            </p>

                        </div>

                        <div className="flex flex-wrap gap-3">

                            <button
                                onClick={loadData}
                                disabled={loading || saving}
                                className="flex items-center gap-2 rounded-xl border px-4 py-3 font-medium hover:bg-[#111c35]/[.045] disabled:opacity-50"
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
                                onClick={handleSave}
                                disabled={loading || saving}
                                className="flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-3 font-medium text-white hover:bg-violet-500 disabled:opacity-50"
                            >

                                <Save size={18} />

                                {saving
                                    ? "Zapisywanie..."
                                    : "Zapisz ustawienia"}

                            </button>

                        </div>

                    </div>

                    {error && (

                        <div className="mt-6 rounded-xl border border-rose-400/20 bg-rose-400/10 p-4 text-rose-200">

                            {error}

                        </div>

                    )}

                    {success && (

                        <div className="mt-6 rounded-xl border border-emerald-400/20 bg-emerald-400/10 p-4 text-emerald-200">

                            {success}

                        </div>

                    )}

                    <div className="mt-8 grid gap-6 lg:grid-cols-2">

                        <section className="rounded-2xl border p-6">

                            <div className="flex items-center gap-3">

                                <div className="rounded-xl bg-[#080e20] p-3">

                                    <User size={22} />

                                </div>

                                <div>

                                    <h2 className="text-xl font-semibold">

                                        Konto

                                    </h2>

                                    <p className="text-sm text-slate-400">

                                        Dane aktualnie zalogowanego użytkownika.

                                    </p>

                                </div>

                            </div>

                            <div className="mt-6 space-y-5">

                                <div>

                                    <label className="mb-2 block text-sm font-medium">

                                        Adres e-mail

                                    </label>

                                    <input
                                        disabled
                                        value={
                                            profile?.email ||
                                            ""
                                        }
                                        placeholder={
                                            loading
                                                ? "Ładowanie..."
                                                : "Brak danych"
                                        }
                                        className="w-full rounded-xl border bg-[#080e20] px-4 py-3 text-slate-300"
                                    />

                                </div>

                                <div>

                                    <label className="mb-2 block text-sm font-medium">

                                        Rola

                                    </label>

                                    <input
                                        disabled
                                        value={
                                            profile?.role ||
                                            ""
                                        }
                                        placeholder={
                                            loading
                                                ? "Ładowanie..."
                                                : "Brak danych"
                                        }
                                        className="w-full rounded-xl border bg-[#080e20] px-4 py-3 text-slate-300"
                                    />

                                </div>

                            </div>

                        </section>

                        <section className="rounded-2xl border p-6">

                            <div className="flex items-center gap-3">

                                <div className="rounded-xl bg-[#080e20] p-3">

                                    <Bot size={22} />

                                </div>

                                <div>

                                    <h2 className="text-xl font-semibold">

                                        PrzemAI

                                    </h2>

                                    <p className="text-sm text-slate-400">

                                        Konfiguracja funkcji AI zapisywana w bazie.

                                    </p>

                                </div>

                            </div>

                            <div className="mt-6 space-y-4">

                                <SettingToggle
                                    icon={<Brain size={18} />}
                                    title="Pamięć AI"
                                    description="Zapamiętywanie trwałych informacji z rozmów."
                                    enabled={settings.memoryEnabled}
                                    disabled={loading || saving}
                                    onClick={() =>
                                        toggleSetting(
                                            "memoryEnabled"
                                        )
                                    }
                                />

                                <SettingToggle
                                    icon={<History size={18} />}
                                    title="Historia analiz"
                                    description="Przechowywanie analiz dokumentów i spotkań."
                                    enabled={settings.historyEnabled}
                                    disabled={loading || saving}
                                    onClick={() =>
                                        toggleSetting(
                                            "historyEnabled"
                                        )
                                    }
                                />

                                <SettingToggle
                                    icon={<Gauge size={18} />}
                                    title="Tryb Executive"
                                    description="Wykorzystywanie danych biznesowych w odpowiedziach AI."
                                    enabled={settings.executiveMode}
                                    disabled={loading || saving}
                                    onClick={() =>
                                        toggleSetting(
                                            "executiveMode"
                                        )
                                    }
                                />

                            </div>

                        </section>

                        <section className="rounded-2xl border p-6">

                            <div className="flex items-center gap-3">

                                <div className="rounded-xl bg-[#080e20] p-3">

                                    <KeyRound size={22} />

                                </div>

                                <div>

                                    <h2 className="text-xl font-semibold">

                                        Zmiana hasła

                                    </h2>

                                    <p className="text-sm text-slate-400">

                                        Zmień hasło do swojego konta PrzemAI.

                                    </p>

                                </div>

                            </div>

                            <form
                                onSubmit={handleChangePassword}
                                className="mt-6 space-y-5"
                            >

                                <PasswordInput
                                    label="Obecne hasło"
                                    value={passwordForm.currentPassword}
                                    show={showPasswords}
                                    onChange={value =>
                                        updatePasswordField(
                                            "currentPassword",
                                            value
                                        )
                                    }
                                />

                                <PasswordInput
                                    label="Nowe hasło"
                                    value={passwordForm.newPassword}
                                    show={showPasswords}
                                    onChange={value =>
                                        updatePasswordField(
                                            "newPassword",
                                            value
                                        )
                                    }
                                />

                                <PasswordInput
                                    label="Powtórz nowe hasło"
                                    value={passwordForm.confirmPassword}
                                    show={showPasswords}
                                    onChange={value =>
                                        updatePasswordField(
                                            "confirmPassword",
                                            value
                                        )
                                    }
                                />

                                <button
                                    type="button"
                                    onClick={() =>
                                        setShowPasswords(current =>
                                            !current
                                        )
                                    }
                                    className="flex items-center gap-2 text-sm text-slate-400 hover:text-slate-100"
                                >

                                    {showPasswords
                                        ? <EyeOff size={17} />
                                        : <Eye size={17} />}

                                    {showPasswords
                                        ? "Ukryj hasła"
                                        : "Pokaż hasła"}

                                </button>

                                {passwordError && (

                                    <div className="rounded-xl border border-rose-400/20 bg-rose-400/10 p-4 text-sm text-rose-200">

                                        {passwordError}

                                    </div>

                                )}

                                {passwordSuccess && (

                                    <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/10 p-4 text-sm text-emerald-200">

                                        {passwordSuccess}

                                    </div>

                                )}

                                <button
                                    type="submit"
                                    disabled={changingPassword}
                                    className="flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-3 font-medium text-white hover:bg-slate-800 disabled:opacity-50"
                                >

                                    <KeyRound size={18} />

                                    {changingPassword
                                        ? "Zmienianie..."
                                        : "Zmień hasło"}

                                </button>

                            </form>

                        </section>

                        <section className="rounded-2xl border p-6">

                            <div className="flex items-center gap-3">

                                <div className="rounded-xl bg-[#080e20] p-3">

                                    <Bot size={22} />

                                </div>

                                <div>

                                    <h2 className="text-xl font-semibold">

                                        Model AI

                                    </h2>

                                    <p className="text-sm text-slate-400">

                                        Model zapisany dla użytkownika.

                                    </p>

                                </div>

                            </div>

                            <div className="mt-6">

                                <label className="mb-2 block text-sm font-medium">

                                    Model

                                </label>

                                <select
                                    value={settings.aiModel}
                                    disabled={loading || saving}
                                    onChange={event => {

                                        setSettings(current => ({

                                            ...current,

                                            aiModel:
                                                event.target.value

                                        }));

                                        setSuccess("");

                                    }}
                                    className="w-full rounded-xl border bg-[#111c35] px-4 py-3 outline-none disabled:bg-[#080e20]"
                                >

                                    <option value="gpt-6.1-sol">GPT-6.1 Sol — rekomendowany</option>
                                    <option value="gpt-6.1-terra">GPT-6.1 Terra — szybki</option>
                                    <option value="gpt-6-astra">GPT-6 Astra — zaawansowany (droższy)</option>
                                    <option value="gpt-6-luna">GPT-6 Luna — ekonomiczny</option>
                                    <option value="gpt-5.5">

                                        GPT-5.5

                                    </option>

                                </select>

                            </div>

                        </section>

                        <section className="rounded-2xl border p-6 lg:col-span-2">

                            <div className="flex items-center gap-3">

                                <div className="rounded-xl bg-[#080e20] p-3">

                                    <Shield size={22} />

                                </div>

                                <div>

                                    <h2 className="text-xl font-semibold">

                                        Integracje

                                    </h2>

                                    <p className="text-sm text-slate-400">

                                        Zewnętrzne usługi i klucze API.

                                    </p>

                                </div>

                            </div>

                            <div className="mt-6 grid gap-3 md:grid-cols-2">

                                <IntegrationRow
                                    name="OpenAI"
                                    status="Aktywne"
                                />

                                <IntegrationRow
                                    name="Microsoft 365"
                                    status="Nie skonfigurowano"
                                />

                                <IntegrationRow
                                    name="Google"
                                    status="Nie skonfigurowano"
                                />

                                <IntegrationRow
                                    name="Teams"
                                    status="Nie skonfigurowano"
                                />

                            </div>

                        </section>

                    </div>

                </div>

            </div>

        </main>

    );

}

function PasswordInput({
    label,
    value,
    show,
    onChange
}) {

    return (

        <div>

            <label className="mb-2 block text-sm font-medium">

                {label}

            </label>

            <input
                type={show ? "text" : "password"}
                value={value}
                onChange={event =>
                    onChange(
                        event.target.value
                    )
                }
                autoComplete="new-password"
                className="w-full rounded-xl border bg-[#111c35] px-4 py-3 outline-none focus:ring-2 focus:ring-violet-400/10"
            />

        </div>

    );

}

function SettingToggle({
    icon,
    title,
    description,
    enabled,
    disabled,
    onClick
}) {

    return (

        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            className="flex w-full items-center justify-between gap-4 rounded-xl border p-4 text-left hover:bg-[#111c35]/[.045] disabled:cursor-not-allowed disabled:opacity-50"
        >

            <div className="flex items-start gap-3">

                <div className="mt-0.5 text-slate-400">

                    {icon}

                </div>

                <div>

                    <div className="font-medium">

                        {title}

                    </div>

                    <div className="mt-1 text-sm text-slate-400">

                        {description}

                    </div>

                </div>

            </div>

            <div
                className={`relative h-6 w-11 shrink-0 rounded-full transition ${
                    enabled
                        ? "bg-violet-600"
                        : "bg-slate-300"
                }`}
            >

                <div
                    className={`absolute top-1 h-4 w-4 rounded-full bg-[#111c35] transition ${
                        enabled
                            ? "left-6"
                            : "left-1"
                    }`}
                />

            </div>

        </button>

    );

}

function IntegrationRow({
    name,
    status
}) {

    const active =
        status === "Aktywne";

    return (

        <div className="flex items-center justify-between rounded-xl border p-4">

            <span className="font-medium">

                {name}

            </span>

            <span
                className={`rounded-full px-3 py-1 text-xs font-medium ${
                    active
                        ? "bg-green-100 text-emerald-200"
                        : "bg-[#080e20] text-slate-400"
                }`}
            >

                {status}

            </span>

        </div>

    );

}