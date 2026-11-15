"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { deduplicateLeads, summarizePipeline, leadFingerprint } = require("../api/services/kaldevaLeadDedup");

test("ten synthetic leads: two duplicates within tenant, no cross-tenant collapse", () => {
  const leads = [
    ...Array.from({ length: 8 }, (_, i) => ({ organizationId: "kaldeva-fixture", email: "person" + i + "@example.test", stage: i < 3 ? "NEW" : "OFFER" })),
    { organizationId: "kaldeva-fixture", email: " PERSON0@example.test ", stage: "NEW" },
    { organizationId: "kaldeva-fixture", email: "person1@example.test", stage: "NEW" },
    { organizationId: "other-fixture", email: "person0@example.test", stage: "SIGNED" }
  ];
  const result = deduplicateLeads(leads);
  assert.equal(result.unique.length, 9);
  assert.equal(result.duplicates.length, 2);
  const report = summarizePipeline(result.unique, "kaldeva-fixture");
  assert.equal(report.NEW, 3);
  assert.equal(report.OFFER, 5);
  assert.equal(report.SIGNED, 0);
  assert.equal(summarizePipeline(result.unique, "other-fixture").SIGNED, 1);
});
test("fail closed without tenant or identifier; hash does not reveal email", () => {
  assert.throws(() => leadFingerprint({ email: "x@example.test" }), /organizationId/);
  assert.throws(() => leadFingerprint({ organizationId: "a" }), /email or phone/);
  assert.notEqual(leadFingerprint({ organizationId: "a", email: "x@example.test" }), leadFingerprint({ organizationId: "b", email: "x@example.test" }));
});
