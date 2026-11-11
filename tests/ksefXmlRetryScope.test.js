"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

test("KSeF XML retry metadata updates retain the company NIP scope", () => {
  const source = fs.readFileSync(
    path.join(__dirname, "../connectors/ksef/syncKsefOwner.js"), "utf8"
  );
  const retryWrite = source.match(
    /const attempts = Math\.min\(100,[\s\S]*?await prisma\.financialDocument\.updateMany\(\{([\s\S]*?)\n\s*\}\);/
  );
  assert.ok(retryWrite, "expected an XML retry metadata update");
  assert.match(retryWrite[1], /where:\s*\{\s*id:\s*item\.id,\s*\.\.\.documentScope\s*\}/);
  assert.doesNotMatch(retryWrite[1], /where:\s*\{\s*id:\s*item\.id,\s*userId,\s*source:/);
});
