"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const page = fs.readFileSync(path.join(__dirname, "../src/app/page.js"), "utf8");

test("dashboard exposes accessible simple/full switch", () => {
  assert.match(page, /aria-label="Tryb pulpitu"/);
  assert.match(page, /aria-pressed=\{simpleMode\}/);
  assert.match(page, /aria-pressed=\{!simpleMode\}/);
  assert.match(page, /switchMode\(true\)/);
  assert.match(page, /switchMode\(false\)/);
});

test("simplified dashboard preserves quick access to agents and financial data", () => {
  for (const route of ["/chat", "/agents", "/finance", "/finance/projects", "/agents/sales"]) {
    assert.ok(page.includes('href="'+route+'"'), route);
  }
  assert.match(page, /simpleMode&&<section aria-label="Szybki dostęp"/);
  assert.match(page, /przemai-dashboard-mode/);
});

test("company chooser links only to organizations returned for the account", () => {
  assert.match(page, /aria-label="Wybór spółki"/);
  assert.match(page, /organizations\.map\(o=><Link key=\{o\.id\}/);
  assert.match(page, /href=\{"\/company\/"\+encodeURIComponent\(o\.id\)\}/);
  assert.match(page, /Wszystkie firmy/);
  assert.match(page, /bez niezweryfikowanej konsolidacji/);
});
