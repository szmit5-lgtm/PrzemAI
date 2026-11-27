import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

test("worker serves only the generic offline document and bypasses API requests", async () => {
  const source = await readFile(new URL("../public/sw.js", import.meta.url), "utf8");
  const listeners = {};
  const cachedPaths = [];
  const fallback = new Response("offline");
  const online = new Response("online");
  let connected = true;
  vm.runInNewContext(source, {
    self: { location: { origin: "https://app.example" }, addEventListener(type, cb) { listeners[type] = cb; } },
    caches: { async open() { return {
      add(path) { cachedPaths.push(path); },
      match(path) { return path === "/mobile/offline.html" ? fallback : undefined; }
    }; } },
    fetch: async () => {
      if (!connected) throw new Error("offline");
      return online;
    },
    Response, URL
  });
  let installed;
  listeners.install({ waitUntil(promise) { installed = promise; } });
  await installed;
  assert.deepEqual(cachedPaths, ["/mobile/offline.html"]);
  const request = (path, mode = "navigate", method = "GET") => {
    let result;
    listeners.fetch({
      request: { url: "https://app.example" + path, method, mode },
      respondWith(value) { result = value; }
    });
    return result;
  };
  assert.equal(await request("/finance"), online);
  connected = false;
  assert.equal(await request("/finance"), fallback);
  assert.equal(request("/api/finance"), undefined);
  assert.equal(request("/chat", "cors"), undefined);
  assert.equal(request("/chat", "navigate", "POST"), undefined);
});
