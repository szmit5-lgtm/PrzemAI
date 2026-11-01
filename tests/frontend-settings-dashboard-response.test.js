"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");

async function loadParser() {
    const source = await fs.readFile(
        path.join(__dirname, "../frontend/src/lib/settingsDashboardPayload.js"), "utf8"
    );
    return import("data:text/javascript;base64," + Buffer.from(source).toString("base64"));
}

const settings = {
    memoryEnabled: true,
    historyEnabled: false,
    executiveMode: true,
    aiModel: "gpt-5.5"
};

test("settings require a confirmed, complete API response", async () => {
    const { parseSettingsResponse } = await loadParser();
    assert.deepEqual(parseSettingsResponse({ success: true, settings }), settings);
    for (const response of [
        null, {}, { settings }, { success: false, settings },
        { success: "true", settings }, { success: true, settings: null },
        { success: true, settings: [] },
        { success: true, settings: { ...settings, memoryEnabled: null } },
        { success: true, settings: { ...settings, historyEnabled: "false" } },
        { success: true, settings: { ...settings, aiModel: "" } }
    ]) {
        assert.throws(() => parseSettingsResponse(response), /Nieprawidłowa odpowiedź ustawień/);
    }
});

test("settings save rejects stale or unconfirmed values", async () => {
    const { parseSettingsResponse } = await loadParser();
    assert.deepEqual(parseSettingsResponse({ success: true, settings }, settings), settings);
    assert.throws(
        () => parseSettingsResponse(
            { success: true, settings: { ...settings, memoryEnabled: false } }, settings
        ),
        /Serwer nie potwierdził zapisania ustawień/
    );
    assert.throws(
        () => parseSettingsResponse({ success: true, settings }, { ...settings, aiModel: "other" }),
        /Serwer nie potwierdził zapisania ustawień/
    );
});

test("profile requires a confirmed user with email and role", async () => {
    const { parseProfileResponse } = await loadParser();
    const user = { id: "user-1", email: "user@example.com", role: "user" };
    assert.deepEqual(parseProfileResponse({ success: true, user }), user);
    for (const response of [
        null, {}, { user }, { success: false, user },
        { success: true, user: null }, { success: true, user: [] },
        { success: true, user: { ...user, email: "" } },
        { success: true, user: { ...user, role: null } }
    ]) {
        assert.throws(() => parseProfileResponse(response), /Nieprawidłowe dane profilu/);
    }
});

test("password form clears only after an explicit API success", async () => {
    const { parsePasswordChangeResponse } = await loadParser();
    assert.equal(parsePasswordChangeResponse({ success: true }), true);
    for (const response of [null, {}, { success: false }, { success: "true" }]) {
        assert.throws(() => parsePasswordChangeResponse(response), /Brak potwierdzenia zmiany hasła/);
    }
});

test("settings UI validates profile, load, save and password acknowledgements", async () => {
    const source = await fs.readFile(
        path.join(__dirname, "../frontend/src/app/settings/page.js"), "utf8"
    );
    assert.match(source, /setProfile\(parseProfileResponse\(profileResponse\)\)/);
    assert.match(source, /setSettings\(parseSettingsResponse\(settingsResponse\)\)/);
    assert.match(source, /setSettings\(parseSettingsResponse\(response, settings\)\)/);
    assert.match(source, /parsePasswordChangeResponse\(passwordResponse\)/);
});
