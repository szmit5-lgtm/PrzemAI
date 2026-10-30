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

function withAuthenticatedBrowser(handler) {
  const previous = {
    fetch: global.fetch,
    window: global.window,
    localStorage: global.localStorage
  };
  const removed = [];
  global.window = { location: { pathname: "/agents", href: "/agents" } };
  global.localStorage = {
    getItem: key => key === "token" ? "dashboard-token" : null,
    removeItem: key => removed.push(key)
  };
  return Promise.resolve().then(() => handler(removed)).finally(() => {
    global.fetch = previous.fetch;
    global.window = previous.window;
    global.localStorage = previous.localStorage;
  });
}

function jsonResponse(data) {
  return {
    status: 200,
    ok: true,
    headers: { get: name => name === "content-type" ? "application/json; charset=utf-8" : null },
    json: async () => data
  };
}

test("agent dashboard retrieves the authenticated agent list from the same-origin API", async () => {
  await withAuthenticatedBrowser(async removed => {
    const payload = { success: true, data: [{ id: "agent-1", status: "IDLE", enabled: true }] };
    global.fetch = async (url, options) => {
      assert.equal(url, "/api/agents");
      assert.equal(options.headers.Authorization, "Bearer dashboard-token");
      assert.equal(options.method, undefined);
      return jsonResponse(payload);
    };
    const api = await loadClient();
    assert.deepEqual(await api.getAgents(), payload);
    assert.deepEqual(removed, []);
  });
});

test("manual agent run posts to the selected agent with the user's token", async () => {
  await withAuthenticatedBrowser(async removed => {
    const payload = { success: true, data: { status: "SUCCESS" } };
    global.fetch = async (url, options) => {
      assert.equal(url, "/api/agents/agent-1/run");
      assert.equal(options.method, "POST");
      assert.equal(options.headers.Authorization, "Bearer dashboard-token");
      return jsonResponse(payload);
    };
    const api = await loadClient();
    assert.deepEqual(await api.runAgent("agent-1"), payload);
    assert.deepEqual(removed, []);
  });
});

test("agent enable/disable sends a JSON boolean, not a string", async () => {
  await withAuthenticatedBrowser(async removed => {
    const seen = [];
    global.fetch = async (url, options) => {
      assert.equal(url, "/api/agents/agent-1/enabled");
      assert.equal(options.method, "PATCH");
      assert.equal(options.headers.Authorization, "Bearer dashboard-token");
      assert.equal(options.headers["Content-Type"], "application/json");
      seen.push(JSON.parse(options.body));
      return jsonResponse({ success: true });
    };
    const api = await loadClient();
    await api.setAgentEnabled("agent-1", false);
    await api.setAgentEnabled("agent-1", true);
    assert.deepEqual(seen, [{ enabled: false }, { enabled: true }]);
    assert.deepEqual(removed, []);
  });
});

test("integrations list uses the authenticated agents endpoint", async () => {
  await withAuthenticatedBrowser(async removed => {
    const payload = { success: true, data: [] };
    global.fetch = async (url, options) => {
      assert.equal(url, "/api/agents/integrations/list");
      assert.equal(options.headers.Authorization, "Bearer dashboard-token");
      return jsonResponse(payload);
    };
    const api = await loadClient();
    assert.deepEqual(await api.getIntegrations(), payload);
    assert.deepEqual(removed, []);
  });
});

test("agent run rejects a 200 response that explicitly reports failure", async () => {
  await withAuthenticatedBrowser(async removed => {
    global.fetch = async (url, options) => {
      assert.equal(url, "/api/agents/agent-1/run");
      assert.equal(options.method, "POST");
      return jsonResponse({ success: false, error: "Agent jest wyłączony." });
    };
    const api = await loadClient();
    await assert.rejects(api.runAgent("agent-1"), { message: "Agent jest wyłączony." });
    assert.deepEqual(removed, []);
  });
});

test("agent list rejects an unsuccessful 200 response without an error message", async () => {
  await withAuthenticatedBrowser(async removed => {
    global.fetch = async () => jsonResponse({ success: false });
    const api = await loadClient();
    await assert.rejects(api.getAgents(), { message: "Operacja nie powiodła się." });
    assert.deepEqual(removed, []);
  });
});

test("agent list rejects HTTP 200 with a JSON null payload", async () => {
  await withAuthenticatedBrowser(async removed => {
    global.fetch = async () => jsonResponse(null);
    const api = await loadClient();
    await assert.rejects(api.getAgents(), { message: "Nieprawidłowa odpowiedź serwera." });
    assert.deepEqual(removed, []);
  });
});

test("agent list rejects HTTP 200 with a JSON primitive payload", async () => {
  await withAuthenticatedBrowser(async removed => {
    global.fetch = async () => jsonResponse("ok");
    const api = await loadClient();
    await assert.rejects(api.getAgents(), { message: "Nieprawidłowa odpowiedź serwera." });
    assert.deepEqual(removed, []);
  });
});

test("agent dashboard expires the session on HTTP 401 even when the proxy returns HTML", async () => {
  await withAuthenticatedBrowser(async removed => {
    global.fetch = async (url, options) => {
      assert.equal(url, "/api/agents");
      assert.equal(options.headers.Authorization, "Bearer dashboard-token");
      return {
        status: 401,
        ok: false,
        headers: { get: () => "text/html; charset=utf-8" }
      };
    };
    const api = await loadClient();
    await assert.rejects(api.getAgents(), { message: "Sesja wygasła." });
    assert.deepEqual(removed, ["token"]);
    assert.equal(global.window.location.href, "/login");
  });
});

test("an HTTP 401 during login does not expire an existing session or redirect", async () => {
  await withAuthenticatedBrowser(async removed => {
    global.fetch = async (url, options) => {
      assert.equal(url, "/api/auth/login");
      assert.equal(options.headers.Authorization, undefined);
      return {
        status: 401,
        ok: false,
        headers: { get: () => "application/json" },
        json: async () => ({ error: "Nieprawidłowe dane logowania." })
      };
    };
    const api = await loadClient();
    await assert.rejects(api.login("user@example.com", "wrong"), {
      message: "Nieprawidłowe dane logowania."
    });
    assert.deepEqual(removed, []);
    assert.equal(global.window.location.href, "/agents");
  });
});
