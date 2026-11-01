"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const login = fs.readFileSync(path.join(__dirname, "../frontend/src/app/login/page.js"), "utf8");
const register = fs.readFileSync(path.join(__dirname, "../frontend/src/app/register/page.js"), "utf8");

test("login and direct registration route honor the same public registration flag", () => {
  const flag = /process\.env\.NEXT_PUBLIC_REGISTRATION_ENABLED\s*!==\s*"false"/;
  assert.match(login, flag);
  assert.match(register, flag);
});

test("disabled registration renders an unavailable message instead of the form", () => {
  assert.match(register, /if \(!registrationEnabled\)\s*\{\s*return\s*\(/);
  assert.match(register, /Rejestracja jest obecnie wyłączona/);
  assert.match(register, /href="\/login"/);
  assert.ok(register.indexOf("if (!registrationEnabled) {") < register.indexOf("<form"));
});

test("disabled registration cannot submit from a stale page", () => {
  assert.match(register, /if \(!registrationEnabled \|\| loading\) return;/);
});
