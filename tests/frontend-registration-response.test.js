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

test("registration inputs have unique attributes, matching labels and password-manager hints", async () => {
    const source = await fs.readFile(
        path.join(__dirname, "../frontend/src/app/register/page.js"), "utf8"
    );
    const inputs = [...source.matchAll(/<input\\b([\\s\\S]*?)\\/>/g)].map(match => match[1]);
    const expected = [
        ["register-email", "email", "email"],
        ["register-password", "password", "new-password"],
        ["register-password-repeat", "passwordRepeat", "new-password"]
    ];
    assert.equal(inputs.length, expected.length);
    for (const [id, name, autocomplete] of expected) {
        const matching = inputs.filter(input => input.includes('id="' + id + '"'));
        assert.equal(matching.length, 1, "exactly one input for " + id);
        const input = matching[0];
        for (const attr of ["id", "name", "autoComplete"]) {
            assert.equal(
                (input.match(new RegExp('\\\\b' + attr + '="', "g")) || []).length,
                1,
                "duplicate " + attr + " on " + id
            );
        }
        assert.match(input, new RegExp('name="' + name + '"'));
        assert.match(input, new RegExp('autoComplete="' + autocomplete + '"'));
        assert.match(source, new RegExp('htmlFor="' + id + '"'));
    }
    assert.match(source, /alert\\(err\\?\\.message \\|\\| "Nie udało się utworzyć konta\\."\\)/);
});
