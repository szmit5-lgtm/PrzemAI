// Require explicit API success and complete payloads before showing saved settings.
const settingKeys = ["memoryEnabled", "historyEnabled", "executiveMode"];

function isRecord(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function parseProfileResponse(response) {
    const user = response?.user;
    if (
        response?.success !== true ||
        !isRecord(user) ||
        typeof user.email !== "string" ||
        !user.email.trim() ||
        typeof user.role !== "string" ||
        !user.role.trim()
    ) {
        throw new Error("Nieprawidłowe dane profilu użytkownika.");
    }
    return user;
}

export function parseSettingsResponse(response, expectedSettings = null) {
    const settings = response?.settings;
    if (
        response?.success !== true ||
        !isRecord(settings) ||
        settingKeys.some(key => typeof settings[key] !== "boolean") ||
        typeof settings.aiModel !== "string" ||
        !settings.aiModel.trim()
    ) {
        throw new Error("Nieprawidłowa odpowiedź ustawień.");
    }

    // Do not claim that a save succeeded if the API returned stale values.
    if (
        expectedSettings !== null &&
        (!isRecord(expectedSettings) ||
            settingKeys.some(key => settings[key] !== expectedSettings[key]) ||
            settings.aiModel !== expectedSettings.aiModel)
    ) {
        throw new Error("Serwer nie potwierdził zapisania ustawień.");
    }

    return {
        memoryEnabled: settings.memoryEnabled,
        historyEnabled: settings.historyEnabled,
        executiveMode: settings.executiveMode,
        aiModel: settings.aiModel
    };
}

export function parsePasswordChangeResponse(response) {
    if (response?.success !== true) {
        throw new Error("Brak potwierdzenia zmiany hasła.");
    }
    return true;
}
