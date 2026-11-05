"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const KsefClient = require("../connectors/ksef/KsefClient");
const { nextHistoryWindow, syncKsefOwner } = require("../connectors/ksef/syncKsefOwner");

test("history window is capped at sixty days and never overlaps recent sync", () => {
  const w = nextHistoryWindow("2026-02-01T00:00:00.000Z", "2026-11-04T00:00:00.000Z");
  assert.equal(w.from, "2026-02-01T00:00:00.000Z");
  assert.equal(w.to, "2026-04-02T00:00:00.000Z");
  assert.equal(nextHistoryWindow("2026-11-05T00:00:00Z", "2026-11-04T00:00:00Z"), null);
  assert.equal(nextHistoryWindow("2025-01-01", "2026-11-04T00:00:00Z"), null);
});

test("KSeF XML fetch validates identity and uses authenticated read-only GET", async () => {
  let calls = 0;
  const id = "1234567890-20261105-AAAAAAAAAAAA-BB";
  const client = new KsefClient({ environment: "test", accessToken: "fake", fetchImpl: async (url, options) => {
    calls++;
    assert.equal(url, "https://api-test.ksef.mf.gov.pl/v2/invoices/ksef/" + id);
    assert.equal(options.method, "GET");
    assert.equal(options.headers.Authorization, "Bearer fake");
    return { ok: true, headers: { get: () => null }, text: async () => '<?xml version="1.0"?><Faktura><Fa /></Faktura>' };
  } });
  await assert.rejects(client.getInvoiceXml("../not-a-number"), /identifier/);
  assert.equal(calls, 0);
  const xml = await client.getInvoiceXml(id);
  assert.match(xml, /<Faktura>/);
  assert.equal(calls, 1);
});

test("history cursor advances only after both directions import successfully", async () => {
  const runs = [];
  const document = { id: "id1", ksefNumber: "1234567890-20261105-AAAAAAAAAAAA-BB" };
  const prisma = {
    agent: {
      async findUnique() { return { config: {} }; },
      async update(args) { runs.push({ type: "cursor", args }); }
    },
    financialDocument: {
      async create() {},
      async findMany() { return [document]; },
      async updateMany(args) { runs.push({ type: "xml", args }); }
    }
  };
  class FakeClient {
    async *iterateInvoiceMetadata({ subjectType, from }) {
      runs.push({ type: "query", subjectType, from });
      yield [{ ksefNumber: "1234567890-20261105-AAAAAAAAAAAA-BB" }];
    }
    async getInvoiceXml() { return "<Faktura></Faktura>"; }
  }
  const result = await syncKsefOwner({
    userId: "owner", prisma, token: "configured", nip: "1234567890", 
    now: new Date("2026-11-05T12:00:00Z"),
    authorize: async () => "access-token", Client: FakeClient
  });
  assert.equal(result.created, 4);
  assert.equal(result.xmlFetched, 1);
  assert.equal(runs.filter(run => run.type === "query").length, 4);
  assert.equal(runs.filter(run => run.type === "cursor").length, 1);
  assert.equal(runs.filter(run => run.type === "xml").length, 2);
  assert.ok(runs.some(run => run.type === "xml" && run.args.data.metadata?.analysis?.version === 1));
});
