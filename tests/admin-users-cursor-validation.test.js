"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const Module = require("node:module");
const path = require("node:path");

test("admin users listing rejects malformed pagination cursors without querying accounts", async () => {
  let handler;
  let reads = 0;
  const router = {
    use() {},
    patch() {},
    get(route, fn) { if (route === "/users") handler = fn; }
  };
  const prisma = {user: {
    async findMany() { reads++; throw new Error("Unexpected account enumeration"); }
  }};
  const originalLoad = Module._load;
  const file = path.resolve(__dirname, "../api/routes/adminRoutes.js");
  try {
    Module._load = function(request, parent, isMain) {
      if (request === "express") return {Router: () => router};
      if (request === "../../lib/prisma") return prisma;
      if (request === "../middleware/verifyToken") return (_req, _res, next) => next();
      return originalLoad.apply(this, arguments);
    };
    delete require.cache[file];
    require(file);
  } finally {
    Module._load = originalLoad;
    delete require.cache[file];
  }
  assert.equal(typeof handler, "function");
  for (const cursor of ["", "   ", "x".repeat(100), ["id1", "id2"], {id:"target"}]) {
    let status = 200, payload;
    const res = {
      status(code) {status = code; return this;},
      json(value) {payload = value; return this;}
    };
    await handler({query:{cursor}}, res);
    assert.equal(status, 400);
    assert.equal(payload.success, false);
    assert.equal(typeof payload.error, "string");
  }
  assert.equal(reads, 0);
});
