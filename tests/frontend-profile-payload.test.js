"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");

async function loadParser() {
    const source = await fs.readFile(
        path.join(__dirname, "../frontend/src/lib/profilePayload.js"), "utf8"
    );
    return import("data:text/javascript;base64," + Buffer.from(source).toString("base64"));
}

test("valid /api/auth/me response confirms an authenticated user", async () => {
    const { parseAuthenticatedProfile } = await loadParser();
    const user = { id: "user-1", email: "person@example.com", role: "user" };
    assert.deepEqual(parseAuthenticatedProfile({ success: true, user }), user);
});

test("a successful HTTP 200 without a confirmed user never unlocks the UI", async () => {
    const { parseAuthenticatedProfile } = await loadParser();
    for (const response of [null, {}, [], { success: true }, { success: false, user: { id: "u", email: "a@b.c" } }, { success: true, user: null }, { success: true, user: [] }, { success: true, user: "user" }]) {
        assert.throws(() => parseAuthenticatedProfile(response), /Nie udało się potwierdzić sesji/);
    }
});

test("profile must include nonempty user ID and email", async () => {
    const { parseAuthenticatedProfile } = await loadParser();
    for (const user of [
        { id: "", email: "person@example.com" },
        { id: "  ", email: "person@example.com" },
        { id: 123, email: "person@example.com" },
        { id: "user-1", email: "" },
        { id: "user-1", email: "  " },
        { id: "user-1", email: null }
    ]) {
        assert.throws(() => parseAuthenticatedProfile({ success: true, user }), /Nie udało się potwierdzić sesji/);
    }
});

test("AuthGuard checks the profile payload before verifying a protected path", async () => {
    const source = await fs.readFile(
        path.join(__dirname, "../frontend/src/app/components/AuthGuard.js"), "utf8"
    );
    assert.match(source, /import\s*\{\s*parseAuthenticatedProfile\s*\}\s*from\s*["']@\/lib\/profilePayload["']/);
    assert.match(source, /parseAuthenticatedProfile\(data\);\s*setVerifiedPath\(pathname\)/);
});
