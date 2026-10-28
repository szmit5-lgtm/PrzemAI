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
    maxRetries: 0,
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


test("KSeF paginates metadata by page index without accumulating unbounded data", async () => {
  const offsets = [];
  const client = new KsefClient({
    accessToken: "test-token",
    fetchImpl: async (url) => {
      const offset = Number(new URL(url).searchParams.get("pageOffset"));
      offsets.push(offset);
      return {
        ok: true,
        json: async () => ({
          invoices: [{ ksefNumber: String(offset) }],
          hasMore: offset < 2,
          isTruncated: false
        })
      };
    }
  });

  const pages = [];
  for await (const page of client.iterateInvoiceMetadata({ from, to })) {
    pages.push(page);
  }
  assert.deepEqual(offsets, [0, 1, 2]);
  assert.deepEqual(pages.map(page => page[0].ksefNumber), ["0", "1", "2"]);
});

test("KSeF refuses truncated metadata rather than silently losing invoices", async () => {
  const client = new KsefClient({
    accessToken: "test-token",
    fetchImpl: async () => ({
      ok: true,
      json: async () => ({
        invoices: [{ ksefNumber: "example" }],
        hasMore: true,
        isTruncated: true
      })
    })
  });
  const iterator = client.iterateInvoiceMetadata({ from, to });
  await assert.rejects(iterator.next(), /truncated/);
});

test("KSeF pagination fails on empty next page and enforces page cap", async () => {
  const client = new KsefClient({
    accessToken: "test-token",
    fetchImpl: async () => ({
      ok: true,
      json: async () => ({
        invoices: [],
        hasMore: true,
        isTruncated: false
      })
    })
  });
  await assert.rejects(
    client.iterateInvoiceMetadata({ from, to }).next(),
    /stalled/
  );
  await assert.rejects(
    client.iterateInvoiceMetadata({ from, to, maxPages: 0 }).next(),
    /maxPages/
  );
  const forever = new KsefClient({
    accessToken: "test-token",
    fetchImpl: async () => ({
      ok: true,
      json: async () => ({
        invoices: [{ ksefNumber: "x" }],
        hasMore: true,
        isTruncated: false
      })
    })
  });
  const pages = forever.iterateInvoiceMetadata({ from, to, maxPages: 2 });
  assert.equal((await pages.next()).done, false);
  assert.equal((await pages.next()).done, false);
  await assert.rejects(pages.next(), /page limit/);
});

test("KSeF retries 429 with capped Retry-After then returns metadata", async () => {
  let calls = 0;
  const delays = [];
  const client = new KsefClient({
    accessToken: "test-token",
    sleepImpl: async ms => { delays.push(ms); },
    fetchImpl: async () => {
      calls += 1;
      if (calls === 1) {
        return { ok: false, status: 429, headers: { get: () => "30" } };
      }
      return {
        ok: true,
        json: async () => ({ invoices: [{ ksefNumber: "test" }], hasMore: false })
      };
    }
  });
  const result = await client.queryInvoiceMetadata({ from, to });
  assert.equal(calls, 2);
  assert.deepEqual(delays, [2000]);
  assert.equal(result.invoices[0].ksefNumber, "test");
});

test("KSeF retries temporary 503 errors with exponential bounded delays", async () => {
  let calls = 0;
  const delays = [];
  const client = new KsefClient({
    accessToken: "test-token",
    sleepImpl: async ms => { delays.push(ms); },
    fetchImpl: async () => {
      calls += 1;
      return calls < 3
        ? { ok: false, status: 503, headers: { get: () => null } }
        : { ok: true, json: async () => ({ invoices: [], hasMore: false }) };
    }
  });
  await client.queryInvoiceMetadata({ from, to });
  assert.equal(calls, 3);
  assert.deepEqual(delays, [250, 500]);
});

test("KSeF never retries authorization failures or logs response content", async () => {
  let calls = 0;
  const client = new KsefClient({
    accessToken: "secret-token",
    sleepImpl: async () => { throw new Error("Must not retry"); },
    fetchImpl: async () => {
      calls += 1;
      return { ok: false, status: 401, headers: { get: () => null } };
    }
  });
  await assert.rejects(
    client.queryInvoiceMetadata({ from, to }),
    error => {
      assert.equal(error.message, "KSeF metadata HTTP 401.");
      assert.doesNotMatch(error.message, /secret-token/);
      return true;
    }
  );
  assert.equal(calls, 1);
});

test("KSeF network errors are retried and redacted after exhaustion", async () => {
  let calls = 0;
  const delays = [];
  const client = new KsefClient({
    accessToken: "secret-token",
    sleepImpl: async ms => { delays.push(ms); },
    fetchImpl: async () => {
      calls += 1;
      throw new Error("transport leaked secret-token");
    }
  });
  await assert.rejects(
    client.queryInvoiceMetadata({ from, to }),
    error => {
      assert.equal(error.message, "KSeF metadata network request failed.");
      assert.doesNotMatch(error.message, /secret-token/);
      return true;
    }
  );
  assert.equal(calls, 3);
  assert.deepEqual(delays, [250, 500]);
});

test("KSeF retry configuration must be bounded", () => {
  for (const maxRetries of [-1, 4, 1.5, "2"]) {
    assert.throws(
      () => new KsefClient({ accessToken: "test-token", maxRetries }),
      /maxRetries/
    );
  }
});
