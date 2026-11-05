"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const KsefClient = require("../connectors/ksef/KsefClient");
const id = "1234567890-20261105-AAAAAAAAAAAA-BB";

test("invoice XML retries short 429 without leaking tokens", async () => {
  let calls = 0;
  const delays = [];
  const client = new KsefClient({
    accessToken: "SECRET",
    sleepImpl: async ms => delays.push(ms),
    fetchImpl: async () => {
      calls += 1;
      return calls === 1
        ? { ok: false, status: 429, headers: { get: () => "1" } }
        : { ok: true, headers: { get: () => null }, text: async () => "<Faktura/>" };
    }
  });
  assert.equal(await client.getInvoiceXml(id), "<Faktura/>");
  assert.equal(calls, 2);
  assert.deepEqual(delays, [1000]);
});

test("invoice XML never retries unauthorized access and refuses XML entities", async () => {
  const bad = new KsefClient({
    accessToken: "SECRET",
    fetchImpl: async () => ({ ok: false, status: 403, headers: { get: () => null } })
  });
  await assert.rejects(bad.getInvoiceXml(id), /HTTP 403/);
  const malicious = new KsefClient({
    accessToken: "SECRET",
    fetchImpl: async () => ({
      ok: true, headers: { get: () => null },
      text: async () => '<!DOCTYPE Faktura [<!ENTITY x SYSTEM "http://invalid">]><Faktura/>'
    })
  });
  await assert.rejects(malicious.getInvoiceXml(id), /Invalid/);
});
