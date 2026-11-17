"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const apiSource = fs.readFileSync(
  path.join(__dirname, "../frontend/src/lib/api.js"), "utf8"
);
const bankPage = fs.readFileSync(
  path.join(__dirname, "../frontend/src/app/company/[id]/bank/page.js"), "utf8"
);
const routes = fs.readFileSync(
  path.join(__dirname, "../api/routes/organizationRoutes.js"), "utf8"
);

function loadBankUpload() {
  const start = apiSource.indexOf("export async function importOrganizationBankCsv(");
  const end = apiSource.indexOf("\nexport async function getOrganizationBankStatements(", start);
  assert.ok(start >= 0 && end > start);
  let lastRequest = null;
  class FakeFormData {
    constructor() { this.fields = []; }
    append(key, value) { this.fields.push([key, value]); }
  }
  const sandbox = {
    FormData: FakeFormData,
    request: async (endpoint, options) => {
      lastRequest = { endpoint, options };
      return { success: true, data: { transactionCount: 2 } };
    },
    Error,
    encodeURIComponent,
    exports: {}
  };
  vm.runInNewContext(
    apiSource.slice(start, end).replace(/^export /, "") +
      "\nexports.upload=importOrganizationBankCsv;",
    sandbox
  );
  return {
    upload: sandbox.exports.upload,
    latest: () => lastRequest
  };
}

const goodFile = { name: "wyciag-listopad.csv", size: 512 };
const metadata = {
  iban: "PL61109010140000071219812874",
  statementNumber: "2026/11",
  openingBalance: "100.00",
  closingBalance: "100.01",
  periodStart: "2026-11-01",
  periodEnd: "2026-11-30"
};

test("bank screen uploads the CSV File to server-side parser, not JSON-transcribed rows", async () => {
  const { upload, latest } = loadBankUpload();
  await upload("dekonica", goodFile, metadata);
  const call = latest();
  assert.equal(call.endpoint, "/api/organizations/dekonica/bank/csv-import");
  assert.equal(call.options.method, "POST");
  assert.equal(call.options.body.fields[0][0], "file");
  assert.equal(call.options.body.fields[0][1], goodFile);
  const fields = Object.fromEntries(call.options.body.fields.slice(1));
  assert.equal(fields.statementNumber, "2026/11");
  assert.equal(fields.closingBalance, "100.01");
  assert.equal(call.options.headers, undefined, "multipart boundary must be provided by browser");
});

test("bank API helper rejects an invalid file or incomplete balance metadata", async () => {
  const { upload, latest } = loadBankUpload();
  for (const file of [null, { name: "wyciag.pdf", size: 120 },
    { name: "data.csv", size: 0 }, { name: "data.csv", size: 2 * 1024 * 1024 + 1 }]) {
    await assert.rejects(upload("dekonica", file, metadata), /CSV/);
  }
  await assert.rejects(upload("", goodFile, metadata), /spółkę/);
  await assert.rejects(upload("dekonica", goodFile,
    { ...metadata, closingBalance: "" }), /Uzupełnij/);
  assert.equal(latest(), null, "no network call on invalid input");
});

test("bank screen confirms CSV upload and keeps PDF read-only preview", () => {
  assert.match(bankPage, /importOrganizationBankCsv/);
  assert.match(bankPage, /setCsvFile\(file\)/);
  assert.match(bankPage, /pdf-preview/);
  assert.doesNotMatch(bankPage, /importOrganizationBankStatement|parseCsv\(/);
});

test("bank CSV and PDF endpoints check owner and active company without mandatory KSeF link", () => {
  const csv = routes.slice(routes.indexOf('router.post("/:id/bank/csv-import"'));
  assert.match(csv, /role: "OWNER"/);
  assert.match(csv, /organization: \{ status: "ACTIVE" \}/);
  assert.doesNotMatch(csv, /financeService\.accessible/);
});
