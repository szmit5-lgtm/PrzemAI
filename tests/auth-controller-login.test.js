"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Module = require("node:module");

let storedUser;
let lookupError;
let validPassword;
let lookups;
let comparisons;
let signed;

const prisma = {
  user: {
    async findUnique(args) {
      lookups.push(args);
      if (lookupError) throw lookupError;
      return storedUser;
    }
  }
};

const hash = {
  async comparePassword(password, hashValue) {
    comparisons.push({ password, hashValue });
    return validPassword;
  },
  async hashPassword() {
    throw new Error("registration must not run in login tests");
  }
};

const jwt = {
  sign(payload, secret, options) {
    signed.push({ payload, secret, options });
    return "test-token";
  }
};

const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
  const source = parent?.filename?.replaceAll("\\", "/") || "";
  if (source.endsWith("/api/controllers/AuthController.js")) {
    if (request === "jsonwebtoken") return jwt;
    if (request === "../../lib/prisma") return prisma;
    if (request === "../../lib/hash") return hash;
  }
  return originalLoad.call(this, request, parent, isMain);
};

let AuthController;
try {
  AuthController = require("../api/controllers/AuthController");
} finally {
  Module._load = originalLoad;
}

function reset() {
  storedUser = {
    id: "user-1",
    email: "test@example.com",
    role: "user",
    password: "stored-password-hash"
  };
  lookupError = null;
  validPassword = true;
  lookups = [];
  comparisons = [];
  signed = [];
}

function response() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    }
  };
}

test("login normalizes email and issues a seven-day JWT for valid credentials", async () => {
  reset();
  const res = response();
  await new AuthController().login({
    body: { email: "  TEST@EXAMPLE.COM  ", password: "correct-password" }
  }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.success, true);
  assert.equal(res.body.token, "test-token");
  assert.deepEqual(lookups, [{ where: { email: "test@example.com" } }]);
  assert.deepEqual(comparisons, [{
    password: "correct-password",
    hashValue: "stored-password-hash"
  }]);
  assert.equal(signed.length, 1);
  assert.deepEqual(signed[0].payload, {
    id: "user-1",
    email: "test@example.com",
    role: "user"
  });
  assert.deepEqual(signed[0].options, { expiresIn: "7d" });
  assert.equal(res.body.user.password, undefined);
});

test("wrong password returns 401 without signing a token", async () => {
  reset();
  validPassword = false;
  const res = response();
  await new AuthController().login({
    body: { email: "test@example.com", password: "wrong-password" }
  }, res);

  assert.equal(res.statusCode, 401);
  assert.equal(res.body.success, false);
  assert.match(res.body.error, /Nieprawidłowy e-mail lub hasło/);
  assert.equal(signed.length, 0);
});

test("unknown user returns the same generic 401 and does not check a password", async () => {
  reset();
  storedUser = null;
  const res = response();
  await new AuthController().login({
    body: { email: "missing@example.com", password: "any-password" }
  }, res);

  assert.equal(res.statusCode, 401);
  assert.match(res.body.error, /Nieprawidłowy e-mail lub hasło/);
  assert.equal(comparisons.length, 0);
  assert.equal(signed.length, 0);
});

test("database failure returns a generic 500 without exposing internal details", async () => {
  reset();
  lookupError = new Error("internal database connection details");
  const res = response();
  await new AuthController().login({
    body: { email: "test@example.com", password: "any-password" }
  }, res);

  assert.equal(res.statusCode, 500);
  assert.equal(res.body.success, false);
  assert.doesNotMatch(res.body.error, /database|connection details/i);
  assert.equal(signed.length, 0);
});


test("me returns a generic error without leaking database details", async () => {
  reset();
  lookupError = new Error("internal database hostname and credentials");
  const res = response();
  await new AuthController().me({ user: { id: "user-1" } }, res);

  assert.equal(res.statusCode, 500);
  assert.equal(res.body.success, false);
  assert.equal(res.body.error, "Nie udało się pobrać danych użytkownika.");
  assert.doesNotMatch(JSON.stringify(res.body), /hostname|credentials/i);
});
