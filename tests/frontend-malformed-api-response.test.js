"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");

async function loadClient() {
  const source = await fs.readFile(
    path.join(__dirname, "../frontend/src/lib/api.js"),
    "utf8"
  );
  return import("data:text/javascript;base64," + Buffer.from(source).toString("base64"));
}

function mockSession() {
  const original = {
    fetch: global.fetch,
    window: global.window,
    localStorage: global.localStorage
  };
  const removed = [];
  global.window = { location: { pathname: "/agents", href: "/agents" } };
  global.localStorage = {
    getItem: () => "valid-until-rejected",
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

function malformedJsonResponse(status) {
  return {
    status,
    ok: status >= 200 && status < 300,
    headers: { get: name => name === "content-type" ? "application/json; charset=utf-8" : null },
    json: async () => { throw new SyntaxError("Malformed upstream JSON"); }
  };
}

test("malformed JSON on 401 still expires the session", async () => {
  const browser = mockSession();
  try {
    global.fetch = async (url, options) => {
      assert.equal(url, "/api/auth/me");
      assert.equal(options.headers.Authorization, "Bearer valid-until-rejected");
      return malformedJsonResponse(401);
    };
    const api = await loadClient();
    await assert.rejects(api.getProfile(), { message: "Sesja wygasła." });
    assert.deepEqual(browser.removed, ["token"]);
    assert.equal(global.window.location.href, "/login");
  } finally {
    browser.restore();
  }
});

test("malformed JSON on 500 reports status without logging out", async () => {
  const browser = mockSession();
  try {
    global.fetch = async () => malformedJsonResponse(500);
    const api = await loadClient();
    await assert.rejects(api.getProfile(), { message: "Błąd serwera (500)." });
    assert.deepEqual(browser.removed, []);
    assert.equal(global.window.location.href, "/agents");
  } finally {
    browser.restore();
  }
});

test("network failure does not discard an authenticated session", async () => {
  const browser = mockSession();
  try {
    global.fetch = async () => { throw new TypeError("Failed to fetch"); };
    const api = await loadClient();
    await assert.rejects(api.getProfile(), { message: "Failed to fetch" });
    assert.deepEqual(browser.removed, []);
    assert.equal(global.window.location.href, "/agents");
  } finally {
    browser.restore();
  }
});
