const { test } = require("node:test");
const assert = require("node:assert/strict");
const { createConfig } = require("./capacitor.config.js");

test("native config does not embed a remote URL by default", () => {
  assert.equal(createConfig().server, undefined);
});

test("staging uses one HTTPS origin without a navigation allowlist", () => {
  assert.deepEqual(createConfig("https://staging.example.com").server, {
    url: "https://staging.example.com", cleartext: false, errorPath: "index.html"
  });
  for (const value of ["http://staging.example.com", "https://x:y@example.org",
    "https://example.org/path", "https://example.org/?q=1", "https://example.org/#id"]) {
    assert.throws(() => createConfig(value));
  }
});

test("the packaged app endpoint is one HTTPS origin", () => {
  const { apiOrigin } = require("./build.cjs");
  assert.equal(apiOrigin("https://api.example.test"), "https://api.example.test");
  assert.equal(apiOrigin(), "");
  for (const value of ["http://api.example.test", "https://login:pass@api.example.test",
    "https://api.example.test/api", "https://api.example.test/?tenant=foreign"])
    assert.throws(() => apiOrigin(value));
});
