"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { importKsefMetadata } = require("../connectors/ksef/importKsefMetadata");

test("KSeF metadata import is tenant-scoped and idempotent", async () => {
  const stored = [];
  const prisma = { financialDocument: { create: async ({ data }) => {
    if (stored.some(x => x.userId === data.userId && x.externalId === data.externalId)) {
      const error = new Error("unique");
      error.code = "P2002";
      throw error;
    }
    stored.push(data);
  } } };
  const invoices = [{ ksefNumber: "1234567890-20261104-AAAAAAAAAAAA-BB", issueDate: "2026-11-04" }];
  assert.deepEqual(await importKsefMetadata({ userId: "dekonica-owner", invoices, prisma }), {
    created: 1, duplicates: 0
  });
  assert.deepEqual(await importKsefMetadata({ userId: "dekonica-owner", invoices, prisma }), {
    created: 0, duplicates: 1
  });
  assert.equal(stored[0].userId, "dekonica-owner");
  assert.equal(stored[0].source, "KSEF");
  assert.equal(stored[0].rawData, undefined);
});

test("KSeF metadata import rejects missing tenant and invalid metadata", async () => {
  const prisma = { financialDocument: { create: async () => {} } };
  await assert.rejects(importKsefMetadata({ invoices: [], prisma }), /configuration/);
  await assert.rejects(importKsefMetadata({
    userId: "owner", invoices: [{ invoiceNumber: "FV/1" }], prisma
  }), /ksefNumber/);
});
