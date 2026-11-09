"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const Module = require("node:module");
const path = require("node:path");

// Regression: a missing verified user must fail closed before any DB access.
test("admin middleware rejects missing identity without querying database", async () => {
  const middleware = [];
  const router = {use: fn => middleware.push(fn), get() {}, patch() {}};
  let reads = 0;
  const originalLoad = Module._load;
  try {
    Module._load = function(request, parent, isMain) {
      if (request === "express") return {Router: () => router};
      if (request === "../../lib/prisma") return {user: {findUnique: async () => {reads++; throw Error("DB must not be called");}}};
      if (request === "../middleware/verifyToken") return (_req, _res, next) => next();
      return originalLoad.apply(this, arguments);
    };
    const file = path.resolve(__dirname, "../api/routes/adminRoutes.js");
    delete require.cache[file];
    require(file);
    delete require.cache[file];
  } finally {
    Module._load = originalLoad;
  }
  for (const user of [undefined, null, {}, {id: ""}]) {
    let status = 200, body, passed = false;
    const response = {status(code) {status = code; return this;}, json(value) {body = value; return this;}};
    await middleware[1]({user}, response, () => {passed = true;});
    assert.equal(status, 401);
    assert.equal(body.success, false);
    assert.equal(passed, false);
  }
  assert.equal(reads, 0);
});
