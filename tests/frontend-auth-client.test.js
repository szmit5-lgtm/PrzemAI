"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");

async function loadClient() {
  // Frontend uses ESM while the backend test runner is CommonJS.
  // Importing the source as a data URL avoids transpilers and external services.
  const source = await fs.readFile(
    path.join(__dirname, "../frontend/src/lib/api.js"),
    "utf8"
  );
  return import("data:text/javascript;base64," + Buffer.from(source).toString("base64"));
}

function mockBrowser(pathname = "/login") {
  const original = {
    fetch: global.fetch,
    window: global.window,
    localStorage: global.localStorage
  };
  const removed = [];
  global.window = { location: { pathname, href: pathname } };
  global.localStorage = {
    getItem: () => "old-token",
    removeItem: key => removed.push(key)
  };
  return {
    removed,
    restore() {
      global.fetch = original.fetch;
      global.window = original.window;
      global.localStorage = original.localStorage;
    }
  };
}

function jsonResponse(status, data) {
  return {
    status,
    ok: status >= 200 && status < 300,
    headers: { get: name => name === "content-type" ? "application/json" : null },
    json: async () => data
  };
}

test("invalid login reports the server's credentials error, not session expiry", async () => {
  const browser = mockBrowser();
  try {
    global.fetch = async (url, options) => {
      assert.equal(url, "/api/auth/login");
      assert.equal(options.headers.Authorization, undefined);
      return jsonResponse(401, { error: "Nieprawidłowy e-mail lub hasło." });
    };
    const api = await loadClient();
    await assert.rejects(
      api.login("test@example.com", "wrong"),
      { message: "Nieprawidłowy e-mail lub hasło." }
    );
    assert.deepEqual(browser.removed, []);
    assert.equal(global.window.location.href, "/login");
  } finally {
    browser.restore();
  }
});

test("401 on a protected endpoint still clears the token and redirects", async () => {
  const browser = mockBrowser("/history");
  try {
    global.fetch = async (url, options) => {
      assert.equal(url, "/api/history");
      assert.equal(options.headers.Authorization, "Bearer old-token");
      return jsonResponse(401, { error: "Unauthorized" });
    };
    const api = await loadClient();
    await assert.rejects(api.getHistory(), { message: "Sesja wygasła." });
    assert.deepEqual(browser.removed, ["token"]);
    assert.equal(global.window.location.href, "/login");
  } finally {
    browser.restore();
  }
});

test("registration does not send a stale bearer token", async () => {
  const browser = mockBrowser("/register");
  try {
    global.fetch = async (url, options) => {
      assert.equal(url, "/api/auth/register");
      assert.equal(options.headers.Authorization, undefined);
      return jsonResponse(201, { success: true });
    };
    const api = await loadClient();
    assert.deepEqual(await api.register("test@example.com", "password123"), { success: true });
  } finally {
    browser.restore();
  }
});

test("successful login returns a token without clearing the existing session", async () => {
  const browser = mockBrowser();
  try {
    global.fetch = async (url, options) => {
      assert.equal(url, "/api/auth/login");
      assert.equal(options.method, "POST");
      assert.equal(options.headers.Authorization, undefined);
      assert.deepEqual(JSON.parse(options.body), {
        email: "test@example.com",
        password: "correct-password"
      });
      return jsonResponse(200, { token: "new-token" });
    };
    const api = await loadClient();
    assert.deepEqual(await api.login("test@example.com", "correct-password"), {
      token: "new-token"
    });
    assert.deepEqual(browser.removed, []);
    assert.equal(global.window.location.href, "/login");
  } finally {
    browser.restore();
  }
});

test("login server errors preserve the session and show the server message", async () => {
  const browser = mockBrowser("/history");
  try {
    global.fetch = async (url, options) => {
      assert.equal(url, "/api/auth/login");
      assert.equal(options.headers.Authorization, undefined);
      return jsonResponse(500, { error: "Serwer chwilowo niedostępny." });
    };
    const api = await loadClient();
    await assert.rejects(
      api.login("test@example.com", "password"),
      { message: "Serwer chwilowo niedostępny." }
    );
    assert.deepEqual(browser.removed, []);
    assert.equal(global.window.location.href, "/history");
  } finally {
    browser.restore();
  }
});
