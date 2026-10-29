"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Module = require("node:module");

let existingUser;
let lookupError;
let createError;
let lookups;
let creations;
let hashes;

const prisma = {
  user: {
    async findUnique(args) {
      lookups.push(args);
      if (lookupError) throw lookupError;
      return existingUser;
    },
    async create(args) {
      creations.push(args);
      if (createError) throw createError;
      return {
        id: "new-user",
        email: args.data.email,
        role: args.data.role,
        createdAt: "2026-10-29T00:00:00.000Z"
      };
    }
  }
};

const hash = {
  async hashPassword(password) {
    hashes.push(password);
    return "hashed-password";
  },
  async comparePassword() {
    throw new Error("login must not run in registration tests");
  }
};

const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
  const source = parent?.filename?.replaceAll("\\", "/") || "";
  if (source.endsWith("/api/controllers/AuthController.js")) {
    if (request === "jsonwebtoken") return { sign() { throw new Error("unexpected JWT"); } };
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
  existingUser = null;
  lookupError = null;
  createError = null;
  lookups = [];
  creations = [];
  hashes = [];
}

function response() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; }
  };
}

async function register(body) {
  const res = response();
  await new AuthController().register({ body }, res);
  return res;
}

test("disabled public registration rejects requests without accessing the database", async () => {
  reset();
  const previous = process.env.ALLOW_PUBLIC_REGISTRATION;
  process.env.ALLOW_PUBLIC_REGISTRATION = "false";
  try {
    const res = await register({ email: "test@example.com", password: "password123" });
    assert.equal(res.statusCode, 403);
    assert.equal(res.body.success, false);
    assert.deepEqual(lookups, []);
    assert.deepEqual(creations, []);
    assert.deepEqual(hashes, []);
  } finally {
    if (previous === undefined) delete process.env.ALLOW_PUBLIC_REGISTRATION;
    else process.env.ALLOW_PUBLIC_REGISTRATION = previous;
  }
});

test("registration requires an email and password before database access", async () => {
  for (const body of [{}, { email: "test@example.com" }, { password: "password123" }]) {
    reset();
    const res = await register(body);
    assert.equal(res.statusCode, 400);
    assert.equal(res.body.success, false);
    assert.deepEqual(lookups, []);
    assert.deepEqual(creations, []);
  }
});

test("registration rejects passwords shorter than eight characters", async () => {
  reset();
  const res = await register({ email: "test@example.com", password: "short" });
  assert.equal(res.statusCode, 400);
  assert.deepEqual(lookups, []);
  assert.deepEqual(creations, []);
  assert.deepEqual(hashes, []);
});

test("duplicate email cannot create another account", async () => {
  reset();
  existingUser = { id: "existing-user" };
  const res = await register({ email: "  TEST@EXAMPLE.COM  ", password: "password123" });
  assert.equal(res.statusCode, 409);
  assert.equal(res.body.success, false);
  assert.deepEqual(lookups, [{ where: { email: "test@example.com" } }]);
  assert.deepEqual(creations, []);
  assert.deepEqual(hashes, []);
});

test("successful registration normalizes email and stores only a password hash", async () => {
  reset();
  const res = await register({ email: "  TEST@EXAMPLE.COM  ", password: "password123" });
  assert.equal(res.statusCode, 201);
  assert.equal(res.body.success, true);
  assert.deepEqual(lookups, [{ where: { email: "test@example.com" } }]);
  assert.deepEqual(hashes, ["password123"]);
  assert.deepEqual(creations, [{
    data: { email: "test@example.com", password: "hashed-password", role: "user" },
    select: { id: true, email: true, role: true, createdAt: true }
  }]);
  assert.deepEqual(res.body.user, {
    id: "new-user", email: "test@example.com", role: "user", createdAt: "2026-10-29T00:00:00.000Z"
  });
  assert.doesNotMatch(JSON.stringify(res.body), /password123|hashed-password/);
});

test("database lookup failure returns a generic error and does not create an account", async () => {
  reset();
  lookupError = new Error("private database hostname and credentials");
  const res = await register({ email: "test@example.com", password: "password123" });
  assert.equal(res.statusCode, 500);
  assert.equal(res.body.success, false);
  assert.deepEqual(creations, []);
  assert.doesNotMatch(JSON.stringify(res.body), /hostname|credentials|private database/i);
});

test("database write failure does not reveal internal details or the password", async () => {
  reset();
  createError = new Error("private database hostname and credentials");
  const res = await register({ email: "test@example.com", password: "password123" });
  assert.equal(res.statusCode, 500);
  assert.equal(res.body.success, false);
  assert.equal(creations.length, 1);
  assert.doesNotMatch(JSON.stringify(res.body), /hostname|credentials|password123|hashed-password/i);
});
