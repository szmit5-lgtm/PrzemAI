"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");

test("problem+json title is shown when a rate-limit response has no detail", async () => {
  const source = await fs.readFile(path.join(__dirname, "../frontend/src/lib/api.js"), "utf8");
  const previous = { fetch: global.fetch, window: global.window, localStorage: global.localStorage };
  const removed = [];
  try {
    global.window = { location: { pathname: "/agents", href: "/agents" } };
    global.localStorage = {
      getItem: () => "active-token",
      removeItem: key => removed.push(key)
    };
    global.fetch = async (url, options) => {
      assert.equal(url, "/api/agents/agent-1/run");
      assert.equal(options.headers.Authorization, "Bearer active-token");
      return {
        status: 429,
        ok: false,
        headers: { get: name => name === "content-type" ? "application/problem+json" : null },
        json: async () => ({ type: "about:blank", title: "Too Many Requests", status: 429 })
      };
    };
    const api = await import("data:text/javascript;base64," + Buffer.from(source).toString("base64"));
    await assert.rejects(api.runAgent("agent-1"), { message: "Too Many Requests", status: 429 });
    assert.deepEqual(removed, []);
    assert.equal(global.window.location.href, "/agents");
  } finally {
    global.fetch = previous.fetch;
    global.window = previous.window;
    global.localStorage = previous.localStorage;
  }
});
