"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { authorizeKsefReadOnly } = require("../connectors/ksef/KsefReadOnlyFlow");

test("KSeF auth rejects absent token before any network request", async () => {
  let calls = 0;
  await assert.rejects(authorizeKsefReadOnly({
    token: "",
    nip: "1133169508",
    fetchImpl: async () => { calls += 1; throw new Error("unexpected request"); }
  }), /token is missing/);
  assert.equal(calls, 0);
});

test("KSeF auth rejects invalid NIP before any network request", async () => {
  let calls = 0;
  await assert.rejects(authorizeKsefReadOnly({
    token: "fake-token",
    nip: "invalid",
    fetchImpl: async () => { calls += 1; throw new Error("unexpected request"); }
  }), /NIP/);
  assert.equal(calls, 0);
});

test("KSeF auth rejects unbounded polling before any network request", async () => {
  let calls = 0;
  await assert.rejects(authorizeKsefReadOnly({
    token: "fake-token",
    nip: "1133169508",
    maxPolls: 10000,
    fetchImpl: async () => { calls += 1; throw new Error("unexpected request"); }
  }), /polling limit/);
  assert.equal(calls, 0);
});
