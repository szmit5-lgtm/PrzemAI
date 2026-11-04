"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { generateKeyPairSync, privateDecrypt, constants } = require("node:crypto");
const { KsefTokenAuth, encryptKsefToken, validateNip } = require("../connectors/ksef/KsefTokenAuth");

test("KSeF token encryption uses RSA-OAEP SHA-256 and token|timestamp", () => {
  const { publicKey, privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const encrypted = encryptKsefToken({
    token: "fake-test-token",
    timestampMs: 1762270000000,
    publicKeyPem: publicKey.export({ type: "spki", format: "pem" })
  });
  const plain = privateDecrypt({
    key: privateKey,
    padding: constants.RSA_PKCS1_OAEP_PADDING,
    oaepHash: "sha256"
  }, Buffer.from(encrypted, "base64")).toString();
  assert.equal(plain, "fake-test-token|1762270000000");
});

test("KSeF rejects invalid NIP", () => {
  assert.equal(validateNip("1234567890"), "1234567890");
  assert.throws(() => validateNip("123456789"), /NIP/);
  assert.throws(() => validateNip("abcdefghij"), /NIP/);
});

test("KSeF auth uses production allowlisted host and never logs response body", async () => {
  const urls = [];
  const auth = new KsefTokenAuth({
    environment: "production",
    fetchImpl: async url => {
      urls.push(url);
      return { ok: false, status: 401 };
    }
  });
  await assert.rejects(auth.challenge(), error => {
    assert.equal(error.message, "KSeF authentication HTTP 401.");
    return true;
  });
  assert.deepEqual(urls, ["https://api.ksef.mf.gov.pl/v2/auth/challenge"]);
});

test("KSeF token redemption requires both access and refresh token", async () => {
  const auth = new KsefTokenAuth({
    fetchImpl: async () => ({
      ok: true,
      json: async () => ({ accessToken: { token: "jwt" } })
    })
  });
  await assert.rejects(auth.redeem("temporary-token"), /redeemed tokens/);
});
