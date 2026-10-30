"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");

async function loadClient() {
  const source = await fs.readFile(path.join(__dirname, "../frontend/src/lib/api.js"), "utf8");
  return import("data:text/javascript;base64," + Buffer.from(source).toString("base64"));
}

for (const status of [204, 205]) {
  test(`agent enable accepts HTTP ${status} with JSON content-type and no body`, async () => {
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
    try {
      global.fetch = async (url, options) => {
        assert.equal(url, "/api/agents/agent-1/enabled");
        assert.equal(options.method, "PATCH");
        assert.equal(options.headers.Authorization, "Bearer active-token");
        assert.deepEqual(JSON.parse(options.body), { enabled: true });
        return {
          status,
          ok: true,
          headers: { get: name => name === "content-type" ? "application/json" : null },
          json: async () => { throw new Error("A no-content response must not be parsed"); }
        };
      };
      const api = await loadClient();
      assert.equal(await api.setAgentEnabled("agent-1", true), null);
      assert.deepEqual(removed, []);
      assert.equal(global.window.location.href, "/agents");
    } finally {
      global.fetch = previous.fetch;
      global.window = previous.window;
      global.localStorage = previous.localStorage;
    }
  });
}
