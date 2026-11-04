"use strict";

const { KsefTokenAuth, validateNip } = require("./KsefTokenAuth");
const { getKsefTokenEncryptionKey } = require("./KsefPublicKey");
const KsefClient = require("./KsefClient");

// Never persist or log the short-lived access or authentication tokens.
// Fail closed on any unexpected status.
async function authorizeKsefReadOnly({
  token, nip, environment = "production", fetchImpl = globalThis.fetch,
  sleepImpl = ms => new Promise(resolve => setTimeout(resolve, ms)),
  maxPolls = 12
} = {}) {
  validateNip(nip);
  if (typeof token !== "string" || !token.trim()) {
    throw new Error("KSeF token is missing.");
  }
  if (!Number.isInteger(maxPolls) || maxPolls < 1 || maxPolls > 30) {
    throw new Error("Invalid KSeF authentication polling limit.");
  }
  const auth = new KsefTokenAuth({ environment, fetchImpl });
  const { publicKeyPem } = await getKsefTokenEncryptionKey({ environment, fetchImpl });
  const started = await auth.beginWithToken({ token, nip, publicKeyPem });
  let authenticated = false;
  for (let attempt = 0; attempt < maxPolls; attempt += 1) {
    if (attempt > 0) await sleepImpl(1000);
    const status = await auth.status(started);
    const code = status?.status?.code;
    if (code === 200) {
      authenticated = true;
      break;
    }
    if (code !== 100 && code !== 150 && code !== 180) {
      throw new Error("KSeF authentication rejected with status " + String(code) + ".");
    }
  }
  if (!authenticated) throw new Error("KSeF authentication timed out.");
  const tokens = await auth.redeem(started.authenticationToken);
  return tokens.accessToken.token;
}

async function fetchKsefInvoiceMetadata({
  token, nip, environment = "production", from, to,
  fetchImpl = globalThis.fetch, sleepImpl
} = {}) {
  const accessToken = await authorizeKsefReadOnly({
    token, nip, environment, fetchImpl, sleepImpl
  });
  const client = new KsefClient({ environment, accessToken, fetchImpl });
  const invoices = [];
  for await (const page of client.iterateInvoiceMetadata({
    subjectType: "Subject2", dateType: "PermanentStorage", from, to,
    pageSize: 100, maxPages: 10
  })) {
    invoices.push(...page);
    if (invoices.length > 1000) {
      throw new Error("KSeF import safety limit reached.");
    }
  }
  return invoices;
}

module.exports = { authorizeKsefReadOnly, fetchKsefInvoiceMetadata };
