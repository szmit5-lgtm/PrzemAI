"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { deduplicateLeads } = require("../api/services/kaldevaLeadDedup");

test("same phone with different email is duplicate inside one tenant", () => {
  const leads = [
    { organizationId: "tenant-a", email: "first@example.test", phone: "+48 500 600 700" },
    { organizationId: "tenant-a", email: "second@example.test", phone: "48500600700" },
    { organizationId: "tenant-b", email: "second@example.test", phone: "48500600700" }
  ];
  const result = deduplicateLeads(leads);
  assert.equal(result.unique.length, 2);
  assert.equal(result.duplicates.length, 1);
});

test("same email with different phone is duplicate; invalid identities fail closed", () => {
  const leads = [
    { organizationId: "tenant-a", email: " X@example.test ", phone: "500600700" },
    { organizationId: "tenant-a", email: "x@EXAMPLE.test", phone: "500600701" }
  ];
  assert.equal(deduplicateLeads(leads).duplicates.length, 1);
  assert.throws(() => deduplicateLeads([{ organizationId: "tenant-a", phone: "++" }]), /invalid phone/);
  assert.throws(() => deduplicateLeads([{ organizationId: "tenant-a", email: "invalid" }]), /invalid email/);
});
