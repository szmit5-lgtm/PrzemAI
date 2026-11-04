"use strict";

const { X509Certificate } = require("node:crypto");

const HOSTS = Object.freeze({
  test: "https://api-test.ksef.mf.gov.pl/v2",
  production: "https://api.ksef.mf.gov.pl/v2"
});

// Certificates are obtained only from the official, environment-specific KSeF host.
// Never follow arbitrary URLs or log certificate endpoint response bodies.
async function getKsefTokenEncryptionKey({
  environment = "test",
  fetchImpl = globalThis.fetch,
  now = new Date()
} = {}) {
  if (!HOSTS[environment] || typeof fetchImpl !== "function") {
    throw new Error("Invalid KSeF public key configuration.");
  }
  let response;
  try {
    response = await fetchImpl(HOSTS[environment] + "/security/public-key-certificates", {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(20000)
    });
  } catch {
    throw new Error("KSeF certificate request failed.");
  }
  if (!response.ok) throw new Error("KSeF certificate HTTP " + response.status + ".");
  let certificates;
  try {
    certificates = await response.json();
  } catch {
    throw new Error("Invalid KSeF certificate response.");
  }
  if (!Array.isArray(certificates) || certificates.length > 100) {
    throw new Error("Invalid KSeF certificate list.");
  }
  const at = new Date(now);
  if (!Number.isFinite(at.getTime())) throw new Error("Invalid certificate validation time.");
  for (const entry of certificates) {
    if (!Array.isArray(entry?.usage) || !entry.usage.includes("KsefTokenEncryption") ||
        typeof entry.certificate !== "string" || entry.certificate.length > 20000) continue;
    try {
      const der = Buffer.from(entry.certificate, "base64");
      const cert = new X509Certificate(der);
      if (cert.publicKey.asymmetricKeyType !== "rsa") continue;
      if (at < new Date(cert.validFrom) || at > new Date(cert.validTo)) continue;
      return {
        publicKeyPem: cert.publicKey.export({ type: "spki", format: "pem" }),
        certificateId: entry.certificateId
      };
    } catch {
      // Ignore malformed entries; never expose certificate body in errors.
    }
  }
  throw new Error("No valid KSeF token encryption certificate.");
}

module.exports = { getKsefTokenEncryptionKey };
