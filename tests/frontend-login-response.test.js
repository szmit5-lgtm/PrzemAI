"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");

async function loadParser() {
  const source = await fs.readFile(
    path.join(__dirname, "../frontend/src/lib/loginPayload.js"), "utf8"
  );
  return import("data:text/javascript;base64," + Buffer.from(source).toString("base64"));
}

test("confirmed login returns a nonempty session token", async () => {
  const { parseLoginResponse } = await loadParser();
  assert.equal(parseLoginResponse({ success: true, token: "signed.jwt.token" }), "signed.jwt.token");
});

test("login rejects a 2xx response without explicit authentication success", async () => {
  const { parseLoginResponse } = await loadParser();
  for (const response of [null, {}, [], { token: "signed.jwt.token" },
    { success: false, token: "signed.jwt.token" },
    { success: "true", token: "signed.jwt.token" }]) {
    assert.throws(() => parseLoginResponse(response), /Nie udało się rozpocząć sesji/);
  }
});

test("login rejects missing, empty or non-string tokens", async () => {
  const { parseLoginResponse } = await loadParser();
  for (const token of [null, undefined, "", "  ", 0, 123, true, {}, []]) {
    assert.throws(
      () => parseLoginResponse({ success: true, token }),
      /Nie udało się rozpocząć sesji/
    );
  }
});

test("login page validates server acknowledgement before storing the token", async () => {
  const source = await fs.readFile(
    path.join(__dirname, "../frontend/src/app/login/page.js"), "utf8"
  );
  assert.match(source, /import\s*\{\s*parseLoginResponse\s*\}\s*from\s*["']@\/lib\/loginPayload["']/);
  assert.match(source, /const token = parseLoginResponse\(await login\(email\.trim\(\), password\)\);/);
  assert.match(source, /localStorage\.setItem\("token", token\);/);
  assert.ok(source.indexOf("parseLoginResponse(await login") < source.indexOf('localStorage.setItem("token", token)'));
});
