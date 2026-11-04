"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { getKsefTokenEncryptionKey } = require("../connectors/ksef/KsefPublicKey");

test("KSeF certificate client uses only official production endpoint", async () => {
  let requested;
  const fetchImpl = async url => {
    requested = url;
    return { ok: true, json: async () => [] };
  };
  await assert.rejects(
    getKsefTokenEncryptionKey({ environment: "production", fetchImpl }),
    /No valid KSeF token encryption certificate/
  );
  assert.equal(requested, "https://api.ksef.mf.gov.pl/v2/security/public-key-certificates");
});

test("KSeF certificate client rejects arbitrary environment and malformed lists", async () => {
  await assert.rejects(
    getKsefTokenEncryptionKey({ environment: "https://attacker.invalid" }),
    /Invalid KSeF public key configuration/
  );
  await assert.rejects(
    getKsefTokenEncryptionKey({
      fetchImpl: async () => ({ ok: true, json: async () => ({ certificate: "bad" }) })
    }),
    /Invalid KSeF certificate list/
  );
});

test("KSeF certificate client redacts upstream errors", async () => {
  await assert.rejects(
    getKsefTokenEncryptionKey({
      fetchImpl: async () => { throw new Error("sensitive data"); }
    }),
    error => {
      assert.equal(error.message, "KSeF certificate request failed.");
      assert.doesNotMatch(error.message, /sensitive data/);
      return true;
    }
  );
});
