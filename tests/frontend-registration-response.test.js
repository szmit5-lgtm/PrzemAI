"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");

async function loadParser() {
    const source = await fs.readFile(
        path.join(__dirname, "../frontend/src/lib/registrationPayload.js"), "utf8"
    );
    return import("data:text/javascript;base64," + Buffer.from(source).toString("base64"));
}

const user = { id: "user-1", email: "person@example.com", role: "user" };

test("confirmed registration accepts the account created for the requested email", async () => {
    const { parseRegistrationResponse } = await loadParser();
    assert.deepEqual(
        parseRegistrationResponse({ success: true, user }, " PERSON@EXAMPLE.COM "),
        user
    );
});

test("registration rejects unconfirmed or malformed success payloads", async () => {
    const { parseRegistrationResponse } = await loadParser();
    for (const response of [
        null, {}, [], { user }, { success: false, user },
        { success: "true", user }, { success: true },
        { success: true, user: null }, { success: true, user: [] },
        { success: true, user: {} },
        { success: true, user: { ...user, id: " " } },
        { success: true, user: { ...user, email: "" } },
        { success: true, user: { ...user, role: null } }
    ]) {
        assert.throws(
            () => parseRegistrationResponse(response, "person@example.com"),
            /Serwer nie potwierdził utworzenia konta/
        );
    }
});

test("registration rejects confirmation for another email", async () => {
    const { parseRegistrationResponse } = await loadParser();
    for (const email of ["another@example.com", "", null]) {
        assert.throws(
            () => parseRegistrationResponse({ success: true, user }, email),
            /Serwer nie potwierdził utworzenia konta/
        );
    }
});

test("registration page validates the API acknowledgement before showing success", async () => {
    const source = await fs.readFile(
        path.join(__dirname, "../frontend/src/app/register/page.js"), "utf8"
    );
    assert.match(source, /import\s*\{\s*parseRegistrationResponse\s*\}\s*from\s*["']@\/lib\/registrationPayload["']/);
    assert.match(source, /parseRegistrationResponse\(await register\(email\.trim\(\), password\), email\);/);
    assert.ok(
        source.indexOf("parseRegistrationResponse(await register") <
        source.indexOf('alert("Konto zostało utworzone.')
    );
});
