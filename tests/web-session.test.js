"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const jwt = require("jsonwebtoken");
const verifyToken = require("../api/middleware/verifyToken");

test("cookie session validates JWT and rejects writes from other origins", t => {
  const key = "isolated-test-signing-key";
  const vars = { JWT_SECRET: key, NODE_ENV: "production", FRONTEND_URL: "https://app.example.test" };
  for (const [name, value] of Object.entries(vars)) {
    const previous = process.env[name];
    process.env[name] = value;
    t.after(() => {
      if (previous === undefined) delete process.env[name];
      else process.env[name] = previous;
    });
  }

  const token = jwt.sign({ id: "user-1" }, key, { expiresIn: "5m" });
  const run = (method, headers) => {
    const req = { method, headers };
    const res = { statusCode: 200, setHeader() {},
      status(code) { this.statusCode = code; return this; }, json() {} };
    verifyToken(req, res, () => {});
    return [res.statusCode, req.user?.id];
  };
  const cookie = "__Host-przemai-session=" + token;
  assert.deepEqual(run("GET", { cookie }), [200, "user-1"]);
  assert.deepEqual(run("POST", { cookie, "sec-fetch-site": "same-origin" }), [200, "user-1"]);
  assert.deepEqual(run("POST", { cookie, origin: "https://app.example.test" }), [200, "user-1"]);
  assert.deepEqual(run("POST", { cookie, "sec-fetch-site": "same-site" }), [403, undefined]);
  assert.deepEqual(run("POST", { cookie, origin: "https://other.example.test" }), [403, undefined]);
  assert.deepEqual(run("POST", { cookie }), [403, undefined]);
  assert.deepEqual(run("GET", { cookie: "przemai-session=" + token }), [401, undefined]);
  assert.deepEqual(run("GET", { cookie: "__Host-przemai-session=invalid" }), [401, undefined]);
  assert.deepEqual(run("GET", { cookie: cookie + "; " + cookie }), [401, undefined]);
  assert.deepEqual(run("POST", { authorization: "Bearer " + token }), [200, "user-1"]);
});
