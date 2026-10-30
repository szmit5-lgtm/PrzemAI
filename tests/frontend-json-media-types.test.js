"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");

async function loadClient() {
  const source = await fs.readFile(path.join(__dirname, "../frontend/src/lib/api.js"), "utf8");
  return import("data:text/javascript;base64," + Buffer.from(source).toString("base64"));
}

function withSession(handler) {
  const previous = {
    fetch: global.fetch,
    window: global.window,
    localStorage: global.localStorage
  };
  const removed = [];
  global.window = { location: { pathname: "/agents", href: "/agents" } };
  global.localStorage = {
    getItem: () => "active-token",
    removeItem: key => removed.push(key)
  };
  return Promise.resolve().then(() => handler(removed)).finally(() => {
    global.fetch = previous.fetch;
    global.window = previous.window;
    global.localStorage = previous.localStorage;
  });
}

test("application/problem+json preserves the API error detail and user session", async () => {
  await withSession(async removed => {
    global.fetch = async (url, options) => {
      assert.equal(url, "/api/agents/agent-1/run");
      assert.equal(options.headers.Authorization, "Bearer active-token");
      return {
        status: 422,
        ok: false,
        headers: { get: name => name === "content-type" ? "application/problem+json; charset=utf-8" : null },
        json: async () => ({ title: "Unprocessable Content", detail: "Agent wymaga konfiguracji." })
      };
    };
    const api = await loadClient();
    await assert.rejects(api.runAgent("agent-1"), {
      message: "Agent wymaga konfiguracji.",
      status: 422
    });
    assert.deepEqual(removed, []);
    assert.equal(global.window.location.href, "/agents");
  });
});

test("vendor +json content type is accepted as a valid agent list response", async () => {
  await withSession(async removed => {
    const payload = { success: true, data: [{ id: "agent-1" }] };
    global.fetch = async (url, options) => {
      assert.equal(url, "/api/agents");
      assert.equal(options.headers.Authorization, "Bearer active-token");
      return {
        status: 200,
        ok: true,
        headers: { get: name => name === "content-type" ? "Application/Vnd.Api+Json" : null },
        json: async () => payload
      };
    };
    const api = await loadClient();
    assert.deepEqual(await api.getAgents(), payload);
    assert.deepEqual(removed, []);
  });
});
