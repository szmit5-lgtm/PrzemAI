import test from "node:test";
import assert from "node:assert/strict";
import { resolveApiProxyTarget } from "../src/lib/proxyTarget.mjs";

test("local development retains localhost fallback", () => {
  assert.equal(resolveApiProxyTarget({}), "http://localhost:3000");
});

test("hosted builds fail closed without an explicit API origin", () => {
  for (const env of [{ VERCEL: "1" }, { RAILWAY_ENVIRONMENT_ID: "synthetic" }]) {
    assert.throws(() => resolveApiProxyTarget(env), /required/);
  }
});

test("valid hosted HTTPS origin is accepted", () => {
  assert.equal(resolveApiProxyTarget({ VERCEL: "1", API_PROXY_TARGET: "https://api.example.test/" }), "https://api.example.test");
});

test("reject unsafe or ambiguous targets", () => {
  for (const target of ["https://example.test/path", "https://user:pass@example.test", "https://example.test/?x=1", "https://example.test/#x", "javascript:alert(1)", "not-a-url"]) {
    assert.throws(() => resolveApiProxyTarget({ API_PROXY_TARGET: target }));
  }
  assert.throws(() => resolveApiProxyTarget({ VERCEL: "1", API_PROXY_TARGET: "http://example.test" }), /HTTPS/);
});

test("hosted builds reject loopback and private IP origins even with HTTPS", () => {
  for (const host of ["localhost", "api.localhost", "127.0.0.1", "10.0.0.1", "172.16.0.2", "192.168.1.2", "169.254.169.254", "[::1]"]) {
    assert.throws(() => resolveApiProxyTarget({ VERCEL: "1", API_PROXY_TARGET: `https://${host}` }), /loopback or private/);
  }
});

test("private targets remain configurable in local development", () => {
  assert.equal(resolveApiProxyTarget({ API_PROXY_TARGET: "http://127.0.0.1:3000" }), "http://127.0.0.1:3000");
});
