"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { createErsteReadOnlyClient, createDisabledErsteTransport } = require("../lib/ersteReadOnlyClient");

test("client rejects missing transport and exposes only read methods", () => {
  assert.throws(() => createErsteReadOnlyClient(), /transport/);
  const client = createErsteReadOnlyClient({ transport: async () => ({ ok: true }) });
  assert.deepEqual(Object.keys(client).sort(), ["getAccount", "getAccountHistory"]);
  assert.equal(Object.isFrozen(client), true);
  assert.equal(client.createPayment, undefined);
});

test("client passes only validated account inquiry requests to mock transport", async () => {
  const requests = [];
  const client = createErsteReadOnlyClient({ transport: async request => { requests.push(request); return { mock: true }; } });
  assert.deepEqual(await client.getAccount("20932721"), { mock: true });
  assert.deepEqual(await client.getAccountHistory("20932721", "2026-10-01", "2026-10-31"), { mock: true });
  assert.deepEqual(requests, [
    { operation: "GetAcct", accountId: "20932721" },
    { operation: "GetAcctHistory", accountId: "20932721", from: "2026-10-01", to: "2026-10-31" }
  ]);
  await assert.rejects(client.getAccountHistory("20932721", "2026-10-31", "2026-10-01"), /date range/);
  assert.equal(requests.length, 2);
});

test("default disabled transport makes no network requests", async () => {
  const client = createErsteReadOnlyClient({ transport: createDisabledErsteTransport() });
  await assert.rejects(client.getAccount("20932721"), /disabled pending verified/);
});
