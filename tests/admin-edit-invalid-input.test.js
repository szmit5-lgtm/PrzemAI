"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const Module = require("node:module");
const path = require("node:path");

test("admin edit rejects invalid input before database access", async () => {
  let patchHandler;
  let dbCalls = 0;
  const router = {
    use() {},
    get() {},
    patch(route, handler) {
      if (route === "/users/:id") patchHandler = handler;
    }
  };
  const db = new Proxy({}, {get() { dbCalls++; throw Error("Unexpected database access"); }});
  const originalLoad = Module._load;
  const file = path.resolve(__dirname, "../api/routes/adminRoutes.js");
  try {
    Module._load = function(request, parent, isMain) {
      if (request === "express") return {Router: () => router};
      if (request === "../../lib/prisma") return {user: db};
      if (request === "../middleware/verifyToken") return (_req, _res, next) => next();
      return originalLoad.apply(this, arguments);
    };
    delete require.cache[file];
    require(file);
  } finally {
    Module._load = originalLoad;
    delete require.cache[file];
  }
  assert.equal(typeof patchHandler, "function");
  const cases = [
    [{params: {id: " "}, body: {email: "person@example.com"}, user: {id: "admin"}}, 400],
    [{params: {id: " target"}, body: {email: "person@example.com"}, user: {id: "admin"}}, 400],
    [{params: {id: "target "}, body: {email: "person@example.com"}, user: {id: "admin"}}, 400],
    [{params: {id: "tar\u0000get"}, body: {email: "person@example.com"}, user: {id: "admin"}}, 400],
    [{params: {id: "tar\tget"}, body: {email: "person@example.com"}, user: {id: "admin"}}, 400],
    [{params: {id: "target"}, body: {email: "not-an-email"}, user: {id: "admin"}}, 400],
    [{params: {id: "target"}, body: {email: "p.szmitkowski@dekonica.com"}, user: {id: "admin"}}, 403],
    [{params: {id: "admin"}, body: {email: "person@example.com"}, user: {id: "admin"}}, 403]
  ];
  for (const [request, expected] of cases) {
    let status = 200, payload;
    const response = {
      status(code) { status = code; return this; },
      json(body) { payload = body; return this; }
    };
    await patchHandler(request, response);
    assert.equal(status, expected);
    assert.equal(payload.success, false);
  }
  assert.equal(dbCalls, 0);
});
