"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

// Regression: a double-escaped regex literal rejects every genuine Meta
// message in the first validation pass, returning 503 before persistence.
test("WhatsApp webhook prevalidation matches persistence regex", () => {
  const source = fs.readFileSync(
    path.join(__dirname, "../api/routes/whatsappRoutes.js"), "utf8"
  );
  const messagePattern = String.raw`/^wamid\.[\w.-]{1,250}$/`;
  const senderPattern = String.raw`/^\d{6,20}$/`;
  assert.equal(source.split(messagePattern).length - 1, 2);
  assert.equal(source.split(senderPattern).length - 1, 2);
  assert.match("wamid.HBgMNTU1MTIzNDU2Nzg5FQIAERgS", /^wamid\.[\w.-]{1,250}$/);
  assert.match("48123456789", /^\d{6,20}$/);
  assert.doesNotMatch("bad-id", /^wamid\.[\w.-]{1,250}$/);
  assert.doesNotMatch("+48123456789", /^\d{6,20}$/);
});
