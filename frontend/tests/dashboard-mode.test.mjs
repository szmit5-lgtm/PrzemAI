import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const page = fs.readFileSync(new URL("../src/app/page.js", import.meta.url), "utf8");

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

test("company selector keeps aggregate view explicitly non-financial", () => {
  assert.match(page, /Nie znaleziono spółek przypisanych do konta/);
  assert.match(page, /nie sumuje danych osobistych ani nie ujawnia danych innych kont/);
  assert.match(page, /getOrganizations\(\)/);
  assert.doesNotMatch(page, /organizations\.concat\(/);
});
