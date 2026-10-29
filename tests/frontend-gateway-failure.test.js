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

function browserSession(pathname) {
  const previous = {
    fetch: global.fetch,
    window: global.window,
    localStorage: global.localStorage
  };
  const removed = [];
  global.window = { location: { pathname, href: pathname } };
  global.localStorage = {
    getItem: () => "active-token",
    removeItem: key => removed.push(key)
  };
  return {
    removed,
    restore() {
      global.fetch = previous.fetch;
      global.window = previous.window;
      global.localStorage = previous.localStorage;
    }
  };
}

function gatewayResponse(status, contentType = "text/html") {
  return {
    status,
    ok: status >= 200 && status < 300,
    headers: {
      get: name => name === "content-type" ? contentType : null
    },
    json: async () => {
      throw new Error("Non-JSON gateway response must not be parsed");
    }
  };
}

test("HTML 502 from API gateway reports an error without clearing the user session", async () => {
  const browser = browserSession("/history");
  try {
    global.fetch = async (url, options) => {
      assert.equal(url, "/api/history");
      assert.equal(options.headers.Authorization, "Bearer active-token");
      return gatewayResponse(502);
    };
    const api = await loadClient();
    await assert.rejects(api.getHistory(), { message: "Błąd serwera (502)." });
    assert.deepEqual(browser.removed, []);
    assert.equal(global.window.location.href, "/history");
  } finally {
    browser.restore();
  }
});

test("registration 401 from a non-JSON gateway response never logs out the current session", async () => {
  const browser = browserSession("/register");
  try {
    global.fetch = async (url, options) => {
      assert.equal(url, "/api/auth/register");
      assert.equal(options.headers.Authorization, undefined);
      return gatewayResponse(401);
    };
    const api = await loadClient();
    await assert.rejects(
      api.register("test@example.com", "password123"),
      { message: "Błąd serwera (401)." }
    );
    assert.deepEqual(browser.removed, []);
    assert.equal(global.window.location.href, "/register");
  } finally {
    browser.restore();
  }
});

test("protected API 401 with HTML response still invalidates the expired token", async () => {
  const browser = browserSession("/history");
  try {
    global.fetch = async () => gatewayResponse(401);
    const api = await loadClient();
    await assert.rejects(api.getHistory(), { message: "Sesja wygasła." });
    assert.deepEqual(browser.removed, ["token"]);
    assert.equal(global.window.location.href, "/login");
  } finally {
    browser.restore();
  }
});
