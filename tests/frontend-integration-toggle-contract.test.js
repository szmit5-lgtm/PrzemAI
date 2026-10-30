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

async function withSession(handler) {
  const previous = {
    fetch: global.fetch,
    window: global.window,
    localStorage: global.localStorage
  };
  const removed = [];
  global.window = { location: { pathname: "/agents", href: "/agents" } };
  global.localStorage = {
    getItem: key => key === "token" ? "integration-test-token" : null,
    removeItem: key => removed.push(key)
  };
  try {
    await handler(removed);
  } finally {
    global.fetch = previous.fetch;
    global.window = previous.window;
    global.localStorage = previous.localStorage;
  }
}

function response(status, payload) {
  return {
    status,
    ok: status >= 200 && status < 300,
    headers: { get: name => name === "content-type" ? "application/json" : null },
    json: async () => payload
  };
}

test("integration enable and disable use an authenticated PATCH with JSON booleans", async () => {
  await withSession(async removed => {
    const requests = [];
    global.fetch = async (url, options) => {
      assert.equal(url, "/api/agents/integrations/gmail/enabled");
      assert.equal(options.method, "PATCH");
      assert.equal(options.headers.Authorization, "Bearer integration-test-token");
      assert.equal(options.headers["Content-Type"], "application/json");
      requests.push(JSON.parse(options.body));
      return response(200, { success: true });
    };
    const api = await loadClient();
    await api.setIntegrationEnabled("gmail", false);
    await api.setIntegrationEnabled("gmail", true);
    assert.deepEqual(requests, [{ enabled: false }, { enabled: true }]);
    assert.deepEqual(removed, []);
  });
});

test("integration toggle does not report success when HTTP 200 contains success false", async () => {
  await withSession(async removed => {
    global.fetch = async () => response(200, {
      success: false,
      error: "Integracja nie może zostać włączona."
    });
    const api = await loadClient();
    await assert.rejects(api.setIntegrationEnabled("gmail", true), {
      message: "Integracja nie może zostać włączona."
    });
    assert.deepEqual(removed, []);
    assert.equal(global.window.location.href, "/agents");
  });
});

test("temporary integration API outage preserves the authenticated session", async () => {
  await withSession(async removed => {
    global.fetch = async () => response(503, {
      error: "Usługa integracji jest chwilowo niedostępna."
    });
    const api = await loadClient();
    await assert.rejects(api.setIntegrationEnabled("gmail", false), {
      message: "Usługa integracji jest chwilowo niedostępna.",
      status: 503
    });
    assert.deepEqual(removed, []);
    assert.equal(global.window.location.href, "/agents");
  });
});
