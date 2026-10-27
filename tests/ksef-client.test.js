"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const KsefClient = require("../connectors/ksef/KsefClient");

const from = "2026-10-01T00:00:00Z";
const to = "2026-10-27T00:00:00Z";

test("KSeF metadata query uses a read-only endpoint and bounded filters", async () => {
  let calls = 0;
  const client = new KsefClient({
    environment: "test",
    accessToken: "test-token",
    fetchImpl: async (url, options) => {
      calls += 1;
      assert.match(url, /^https:\/\/api-test\.ksef\.mf\.gov\.pl\/v2\/invoices\/query\/metadata\?/);
      assert.equal(options.method, "POST");
      assert.equal(options.headers.Authorization, "Bearer test-token");
      const body = JSON.parse(options.body);
      assert.equal(body.subjectType, "Subject2");
      assert.equal(body.dateRange.dateType, "PermanentStorage");
      assert.equal(body.dateRange.from, from);
      assert.equal(body.dateRange.to, to);
      return {
        ok: true,
        json: async () => ({ invoices: [], hasMore: false, isTruncated: false })
      };
    }
  });

  const result = await client.queryInvoiceMetadata({ from, to });
  assert.equal(calls, 1);
  assert.deepEqual(result.invoices, []);
});

test("KSeF rejects missing credentials, invalid environment and unsafe date ranges", async () => {
  assert.throws(() => new KsefClient({ environment: "wrong", accessToken: "x" }));
  assert.throws(() => new KsefClient({ environment: "test" }));
  const client = new KsefClient({
    accessToken: "test-token",
    fetchImpl: async () => { throw new Error("Network must not be called"); }
  });
  await assert.rejects(
    client.queryInvoiceMetadata({ from: "2026-01-01T00:00:00Z", to }),
    /100 days/
  );
  await assert.rejects(
    client.queryInvoiceMetadata({ from: "2026-10-01", to }),
    /UTC offsets/
  );
  await assert.rejects(
    client.queryInvoiceMetadata({ from, to, pageSize: 251 }),
    /pagination/
  );
});

test("KSeF HTTP errors never expose access tokens or invoice data", async () => {
  const token = "secret-must-not-appear";
  const client = new KsefClient({
    accessToken: token,
    fetchImpl: async () => ({
      ok: false,
      status: 429,
      headers: { get: () => "30" }
    })
  });
  await assert.rejects(
    client.queryInvoiceMetadata({ from, to }),
    error => {
      assert.match(error.message, /429/);
      assert.match(error.message, /30 seconds/);
      assert.doesNotMatch(error.message, /secret-must-not-appear/);
      return true;
    }
  );
});
