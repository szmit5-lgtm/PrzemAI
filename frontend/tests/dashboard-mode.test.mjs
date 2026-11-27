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
  assert.match(page, /\{<section aria-label="Szybki dostęp"/);
  const quickAccess = page.match(/<section aria-label="Szybki dostęp"[\s\S]*?<\/section>/)?.[0];
  assert.ok(quickAccess);
  for (const route of ["/chat", "/agents", "/finance", "/finance/projects", "/agents/sales"]) {
    assert.ok(quickAccess.includes('href="'+route+'"'), route);
  }
  assert.match(page, /przemai-dashboard-mode/);
});

test("company chooser links only to organizations returned for the account", () => {
  assert.match(page, /aria-label="Wybór spółki"/);
  const chooser = page.match(/<section aria-label="Wybór spółki"[\s\S]*?<\/section>/)?.[0];
  assert.ok(chooser);
  assert.match(chooser, /organizations\.map\(o=><div key=\{o\.id\}/);
  assert.match(chooser, /onClick=\{\(\)=>selectPrimaryCompany\(o\.id\)\}/);
  assert.match(chooser, /href=\{"\/company\/"\+encodeURIComponent\(o\.id\)\}/);
  assert.match(page, /const allowed=organizations\.some\(o=>o\.id===primaryCompany\)/);
  assert.match(page, /if\(!allowed\)\{setCompanyFinance\(null\);setCompanyFinanceError/);
  assert.match(page, /selectedOrg&&companyFinanceState\?\.organizationId===primaryCompany/);
  assert.match(page, /report.organizationId!==\(primaryCompany\|\|null\)/);
  assert.match(page, /const projects=primaryCompany&&!selectedOrg\?\[\]/);
  assert.match(page, /Dostępne spółki/);
  assert.match(page, /Spółki z dostępnymi danymi KSeF/);
});

test("company selector uses organization invoice totals without a personal fallback", () => {
  assert.match(page, /Nie znaleziono spółek przypisanych do konta/);
  assert.match(page, /getInvoiceDashboard\(invoiceYear,primaryCompany,controller.signal\)/);
  assert.doesNotMatch(page, /getFinanceSummary/);
  assert.match(page, /getOrganizations\(\)/);
  assert.doesNotMatch(page, /organizations\.concat\(/);
});
