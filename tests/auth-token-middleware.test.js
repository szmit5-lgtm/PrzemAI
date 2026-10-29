"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Module = require("node:module");

const verified = [];
const claims = { id: "user-1", email: "test@example.com", role: "user" };
const jwtStub = {
  verify(token, secret) {
    verified.push({ token, secret });
    if (token === "valid-token") return claims;
    throw new Error("JWT signature invalid: sensitive internal diagnostic");
  }
};

const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === "jsonwebtoken" && parent?.filename?.replaceAll("\\", "/").endsWith("/api/middleware/verifyToken.js")) {
    return jwtStub;
  }
  return originalLoad.call(this, request, parent, isMain);
};

let verifyToken;
try {
  verifyToken = require("../api/middleware/verifyToken");
} finally {
  Module._load = originalLoad;
}

function run(authorization) {
  verified.length = 0;
  const req = { headers: authorization === undefined ? {} : { authorization } };
  let nextCalls = 0;
  const res = {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; }
  };
  verifyToken(req, res, () => { nextCalls += 1; });
  return { req, res, nextCalls };
}

test("missing authorization is rejected without verifying or calling next", () => {
  const { req, res, nextCalls } = run();
  assert.equal(res.statusCode, 401);
  assert.deepEqual(res.body, { success: false, error: "Brak tokena." });
  assert.equal(req.user, undefined);
  assert.equal(nextCalls, 0);
  assert.equal(verified.length, 0);
});

test("non-Bearer and malformed authorization headers are rejected", () => {
  for (const header of ["Basic abc", "Bearer", "Bearer one two"]) {
    const { res, nextCalls } = run(header);
    assert.equal(res.statusCode, 401);
    assert.deepEqual(res.body, { success: false, error: "Nieprawidłowy format tokena." });
    assert.equal(nextCalls, 0);
    assert.equal(verified.length, 0);
  }
});

test("invalid JWT is rejected without exposing verifier internals", () => {
  const { req, res, nextCalls } = run("Bearer invalid-token");
  assert.equal(res.statusCode, 401);
  assert.deepEqual(res.body, { success: false, error: "Token jest nieważny." });
  assert.doesNotMatch(JSON.stringify(res.body), /signature|diagnostic|internal/i);
  assert.equal(req.user, undefined);
  assert.equal(nextCalls, 0);
  assert.equal(verified.length, 1);
});

test("valid JWT passes verified claims to the protected route exactly once", () => {
  const { req, res, nextCalls } = run("Bearer valid-token");
  assert.equal(res.statusCode, 200);
  assert.equal(res.body, null);
  assert.deepEqual(req.user, claims);
  assert.equal(nextCalls, 1);
  assert.deepEqual(verified, [{ token: "valid-token", secret: process.env.JWT_SECRET }]);
});
