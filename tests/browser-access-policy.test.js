"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const {BrowserAccessPolicy,assertAllowedNavigation} = require("../core/browser/BrowserAccessPolicy");

test("allows only explicitly approved HTTPS hostnames", () => {
  const policy = new BrowserAccessPolicy({
    companyId:"dekonica",agentId:"sales",allowedDomains:["allegro.pl"],mode:"READ_ONLY"
  });
  assert.equal(policy.navigate("https://allegro.pl/oferta/example"),"https://allegro.pl/oferta/example");
  for (const url of [
    "http://allegro.pl/oferta", "https://evilallegro.pl/",
    "https://sub.allegro.pl/", "https://allegro.pl.evil.org/",
    "https://user:pass@allegro.pl/", "https://allegro.pl:8443/",
    "file:///etc/passwd", "http://127.0.0.1/", "https://localhost/"
  ]) assert.throws(() => policy.navigate(url), url);
});
test("deny by default, isolated by company/agent and no automatic writes", () => {
  assert.throws(() => assertAllowedNavigation("https://allegro.pl",[]));
  assert.throws(() => new BrowserAccessPolicy({agentId:"sales",allowedDomains:["allegro.pl"]}));
  const policy = new BrowserAccessPolicy({
    companyId:"dekonica",agentId:"sales",allowedDomains:["allegro.pl"],mode:"APPROVAL_REQUIRED"
  });
  assert.throws(() => policy.authorizeWrite());
  assert.equal(policy.authorizeWrite({approved:true}),true);
  const readOnly = new BrowserAccessPolicy({companyId:"dekonica",agentId:"sales",allowedDomains:["allegro.pl"]});
  assert.throws(() => readOnly.authorizeWrite({approved:true}));
});
test("invalid or IP allowlist entries are refused", () => {
  for (const name of ["localhost","127.0.0.1","a..com","-bad.example","bad-.example","https://allegro.pl"]) {
    assert.throws(() => new BrowserAccessPolicy({companyId:"x",agentId:"y",allowedDomains:[name]}));
  }
});
