"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { mapKsefInvoice } = require("../connectors/ksef/mapKsefInvoice");
const { importKsefMetadata } = require("../connectors/ksef/importKsefMetadata");

const record = {
  ksefNumber: "1234567890-20261105-AAAAAAAAAAAA-BB",
  invoiceNumber: "FV/45/2026",
  issueDate: "2026-11-05",
  seller: { nip: "1234567890", name: "Dostawca" },
  buyer: { identifier: { type: "Nip", value: "9876543210" }, name: "Dekonica" },
  netAmount: 1000.25, vatAmount: 230.06, grossAmount: 1230.31, currency: "PLN"
};

test("metadata maps documented supplier, buyer, net, VAT and gross", () => {
  const mapped = mapKsefInvoice(record, { direction: "INCOMING" });
  assert.equal(mapped.invoiceNumber, "FV/45/2026");
  assert.equal(mapped.sellerNip, "1234567890");
  assert.equal(mapped.buyerNip, "9876543210");
  assert.equal(mapped.grossAmount, "1230.31");
  assert.equal(mapped.netAmount, "1000.25");
  assert.equal(mapped.vatAmount, "230.06");
  assert.equal(mapped.direction, "INCOMING");
});

test("metadata ignores malformed and untrusted amount fields", () => {
  const mapped = mapKsefInvoice({ ksefNumber: "test", netAmount: "1000", grossAmount: Infinity });
  assert.equal(mapped.netAmount, undefined);
  assert.equal(mapped.grossAmount, undefined);
});

test("repeat metadata sync enriches an existing invoice without overwriting its details", async () => {
  const writes = [];
  const prisma = { financialDocument: {
    create: async () => { const e = new Error("duplicate"); e.code = "P2002"; throw e; },
    updateMany: async update => { writes.push(update); return { count: 1 }; }
  } };
  const result = await importKsefMetadata({ userId: "owner", invoices: [record], prisma });
  assert.deepEqual(result, { created: 0, duplicates: 1 });
  assert.equal(writes[0].data.grossAmount, "1230.31");
  assert.equal(writes[0].data.rawData, undefined);
  assert.equal(writes[0].where.userId, "owner");
});
