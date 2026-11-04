"use strict";

const { publicEncrypt, constants, createPublicKey } = require("node:crypto");

const HOSTS = Object.freeze({
  test: "https://api-test.ksef.mf.gov.pl/v2",
  production: "https://api.ksef.mf.gov.pl/v2"
});

function validateNip(nip) {
  if (typeof nip !== "string" || !/^[0-9]{10}$/.test(nip)) {
    throw new Error("KSeF context NIP must contain 10 digits.");
  }
  return nip;
}

function encryptKsefToken({ token, timestampMs, publicKeyPem }) {
  if (typeof token !== "string" || !token.trim() ||
      !Number.isSafeInteger(timestampMs) || timestampMs <= 0) {
    throw new Error("Invalid KSeF token challenge inputs.");
  }
  // The key must be supplied from the official KSeF certificate endpoint.
  // Never use an arbitrary key from a user-provided URL.
  const key = createPublicKey(publicKeyPem);
  if (key.asymmetricKeyType !== "rsa") throw new Error("KSeF encryption requires RSA.");
  return publicEncrypt({
    key,
    padding: constants.RSA_PKCS1_OAEP_PADDING,
    oaepHash: "sha256"
  }, Buffer.from(token + "|" + timestampMs, "utf8")).toString("base64");
}

class KsefTokenAuth {
  constructor({ environment = "test", fetchImpl = globalThis.fetch } = {}) {
    if (!HOSTS[environment] || typeof fetchImpl !== "function") {
      throw new Error("Invalid KSeF authentication configuration.");
    }
    this.baseUrl = HOSTS[environment];
    this.fetchImpl = fetchImpl;
  }

  async request(path, { method = "POST", body, bearer } = {}) {
    let response;
    try {
      response = await this.fetchImpl(this.baseUrl + path, {
        method,
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "X-Error-Format": "problem-details",
          ...(bearer ? { Authorization: "Bearer " + bearer } : {})
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        signal: AbortSignal.timeout(20000)
      });
    } catch {
      throw new Error("KSeF authentication network request failed.");
    }
    if (!response.ok) {
      // Never echo server error bodies: they may contain sensitive data.
      throw new Error("KSeF authentication HTTP " + response.status + ".");
    }
    try {
      return await response.json();
    } catch {
      throw new Error("Invalid KSeF authentication response.");
    }
  }

  async challenge() {
    const data = await this.request("/auth/challenge");
    if (typeof data?.challenge !== "string" ||
        !Number.isSafeInteger(data.timestampMs)) {
      throw new Error("Invalid KSeF challenge.");
    }
    return { challenge: data.challenge, timestampMs: data.timestampMs };
  }

  async beginWithToken({ token, nip, publicKeyPem, publicKeyId }) {
    validateNip(nip);
    const { challenge, timestampMs } = await this.challenge();
    const encryptedToken = encryptKsefToken({ token, timestampMs, publicKeyPem });
    const data = await this.request("/auth/ksef-token", {
      body: {
        challenge,
        contextIdentifier: { type: "Nip", value: nip },
        encryptedToken,
        ...(publicKeyId ? { publicKeyId } : {})
      }
    });
    if (typeof data?.referenceNumber !== "string" ||
        typeof data?.authenticationToken?.token !== "string") {
      throw new Error("Invalid KSeF authentication initiation response.");
    }
    return {
      referenceNumber: data.referenceNumber,
      authenticationToken: data.authenticationToken.token
    };
  }

  async status({ referenceNumber, authenticationToken }) {
    if (!/^[a-zA-Z0-9-]{1,80}$/.test(referenceNumber || "") ||
        !authenticationToken) throw new Error("Invalid KSeF authentication status inputs.");
    return this.request("/auth/" + referenceNumber, {
      method: "GET", bearer: authenticationToken
    });
  }

  async redeem(authenticationToken) {
    if (typeof authenticationToken !== "string" || !authenticationToken) {
      throw new Error("Missing KSeF authentication token.");
    }
    const data = await this.request("/auth/token/redeem", { bearer: authenticationToken });
    if (typeof data?.accessToken?.token !== "string" ||
        typeof data?.refreshToken?.token !== "string") {
      throw new Error("Invalid KSeF redeemed tokens.");
    }
    return data;
  }
}

module.exports = { KsefTokenAuth, encryptKsefToken, validateNip };
