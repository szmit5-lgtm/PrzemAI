"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const read = filename => fs.readFileSync(path.join(__dirname, "..", filename), "utf8");
const nav = read("frontend/src/app/components/Navbar.js");
const root = read("frontend/src/app/page.js");
const personal = read("frontend/src/app/document/page.js");
const company = read("frontend/src/app/company/[id]/documents/page.js");
const companyWorkspace = read("frontend/src/app/company/[id]/page.js");
const switcher = read("frontend/src/app/components/DocumentScopeSwitcher.js");
const uploader = read("frontend/src/app/company/[id]/CompanyDocuments.js");
const api = read("api/routes/organizationDocumentRoutes.js");

test("navbar routes Documents to selected company, not personal uploader", () => {
  assert.match(nav, /const companyMatch =/);
  assert.match(nav, /const documentsHref = companySegment/);
  assert.match(nav, /organizationId \? "\/company\/" \+ encodeURIComponent\(organizationId\)/);
  assert.match(nav, /link\.href === "\/document" && documentsHref !== "\/document"/);
  assert.match(nav, /href: documentsHref, label: "Dokumenty spółki"/);
  assert.match(root, /Navbar vertical organizationId=\{/);
  assert.match(root, /Navbar organizationId=\{/);
  assert.match(root, /\["OWNER","ADMIN"\]\.includes\(selectedOrg\?\.role\)/);
});

test("personal page never suggests its upload belongs to the selected company", () => {
  assert.match(personal, /Dokumenty osobiste/);
  assert.match(personal, /<DocumentScopeSwitcher\s*\/>/);
  assert.match(personal, /Wybrana przestrzeń: konto osobiste/);
  assert.match(personal, /<FileUpload mode="document"/);
});

test("company documents have their own URL, verified organization and visible name", () => {
  assert.match(company, /getOrganization\(id\)/);
  assert.match(company, /result\.data\.id !== id/);
  assert.match(company, /\["OWNER", "ADMIN"\]\.includes\(company\.role\)/);
  assert.match(company, /Dokumenty — /);
  assert.match(company, /<DocumentScopeSwitcher activeOrganizationId=\{id\}\/>/);
  assert.match(company, /<CompanyDocuments organizationId=\{id\} organizationName=/);
  assert.match(companyWorkspace, /href=\{"\/company\/"\+encodeURIComponent\(id\)\+"\/documents"\}/);
  assert.match(companyWorkspace, /<CompanyDocuments organizationId=\{id\} organizationName=/);
});

test("selector uses separate URLs and only shows owner's or admin's company list", () => {
  assert.match(switcher, /getOrganizations\(\)/);
  assert.match(switcher, /\["OWNER", "ADMIN"\]\.includes\(company\.role\)/);
  assert.match(switcher, /company\.status === "ACTIVE"/);
  assert.match(switcher, /href="\/document"/);
  assert.match(switcher, /encodeURIComponent\(company\.id\) \+ "\/documents"/);
  assert.match(switcher, /aria-current=\{activeOrganizationId === company\.id/);
});

test("uploads display company attribution and API enforces company isolation", () => {
  assert.match(uploader, /Przypisanie pliku:/);
  assert.match(uploader, /Spółka: \{organizationName/);
  assert.match(api, /organizations\.membership\(req\.user\?\.id, req\.params\.id, \["OWNER", "ADMIN"\]\)/);
  assert.match(api, /where: \{ organizationId: req\.params\.id \}/);
  assert.match(api, /where: \{ id: req\.params\.documentId, organizationId: req\.params\.id \}/);
});
