"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { syncKsefOwner } = require("../connectors/ksef/syncKsefOwner");

test("Deherus sync keeps NIP-scoped XML queries, project scope and independent history cursor", async () => {
  const reads = [];
  const updates = [];
  const prisma = {
    agent: {
      async findUnique() { return { config: { ksefBackfillCursor: "2026-10-01T00:00:00.000Z" } }; },
      async update(args) { updates.push(args); }
    },
    financialDocument: {
      async create() {},
      async findMany(args) { reads.push(args); return []; },
      async updateMany() { throw new Error("Unexpected document mutation"); }
    },
    project: {
      async findMany() { return [
        { id: "d", company: "Dekonica", name: "D", status: "ACTIVE" },
        { id: "m", company: "M1", name: "M", status: "ACTIVE" }
      ]; }
    }
  };
  class FakeClient {
    async *iterateInvoiceMetadata() { yield []; }
  }
  await syncKsefOwner({
    userId: "owner", prisma, token: "test", nip: "1133200454",
    company: "deherus", now: new Date("2026-11-10T12:00:00Z"),
    authorize: async () => "fake", Client: FakeClient, historyWindowsPerRun: 1
  });
  assert.equal(updates.length, 1);
  assert.equal(updates[0].data.config.ksefBackfillCursor, "2026-10-01T00:00:00.000Z");
  assert.equal(updates[0].data.config.ksefDeherusBackfillCursor, "2026-04-02T00:00:00.000Z");
  assert.ok(reads.length >= 2);
  for (const args of reads) {
    assert.equal(args.where.userId, "owner");
    assert.equal(args.where.source, "KSEF");
    assert.deepEqual(args.where.OR, [{ buyerNip: "1133200454" }, { sellerNip: "1133200454" }]);
  }
});

test("unknown KSeF company scope is rejected before authentication", async () => {
  await assert.rejects(syncKsefOwner({
    userId: "owner", prisma: { financialDocument: {}, agent: {} },
    nip: "1133200454", company: "other",
    authorize: async () => { throw new Error("must not authenticate"); }
  }), /Invalid KSeF company scope/);
});
