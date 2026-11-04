"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { mapKsefInvoice } = require("../connectors/ksef/mapKsefInvoice");

test("KSeF mapping retains stable invoice identity without inventing amounts", () => {
  const result = mapKsefInvoice({ ksefNumber: "KSEF-123", issueDate: "2026-11-04" });
  assert.equal(result.source, "KSEF");
  assert.equal(result.externalId, "KSEF-123");
  assert.equal(result.ksefNumber, "KSEF-123");
  assert.equal(result.issueDate.toISOString(), "2026-11-04T00:00:00.000Z");
  assert.equal(result.grossAmount, undefined);
  assert.deepEqual(result.metadata, { importedFrom: "KSEF_METADATA" });
});

test("KSeF mapping rejects missing identity and malformed date", () => {
  assert.throws(() => mapKsefInvoice({}), /ksefNumber/);
  assert.throws(() => mapKsefInvoice(null), /Invalid/);
  assert.throws(() => mapKsefInvoice({ ksefNumber: "x", issueDate: "invalid" }), /date/);
});

test("KSeF mapping does not persist upstream token or arbitrary raw fields", () => {
  const result = mapKsefInvoice({
    ksefNumber: "KSEF-456",
    accessToken: "never-persist-this",
    arbitraryPrivateField: "do-not-copy"
  });
  assert.doesNotMatch(JSON.stringify(result), /never-persist-this|do-not-copy/);
});
