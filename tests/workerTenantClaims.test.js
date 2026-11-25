"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const source = fs.readFileSync(path.join(__dirname, "../worker.js"), "utf8");

test("scheduled agent claim includes tenant userId", () => {
  assert.match(source, /id: agent\.id,\s*userId: agent\.userId,\s*enabled: true,/);
});
test("shutdown claim release cannot modify a different tenant", () => {
  assert.match(source, /where: \{ id: agent\.id, userId: agent\.userId, status: "RUNNING" \}/);
});
test("stale recovery write respects configured worker owner scope", () => {
  assert.match(source, /id: agent\.id,\s*status: "RUNNING",\s*\.\.\.\(ownerScope \? \{ userId: ownerScope \} : \{\}\)/);
});
