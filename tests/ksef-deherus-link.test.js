"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");

test("Deherus company cannot link KSeF before isolated sync is enabled", async () => {
  const { OrganizationFinanceService } = require("../api/services/OrganizationFinanceService");
  const db = {
    organization: { findUnique: async () => ({
      id: "deherus", name: "M1", slug: "m1", displayName: "Deherus", status: "ACTIVE"
    }) },
    organizationFinanceLink: { findUnique: async () => null },
    organizationMembership: { findFirst: async () => null }
  };
  const orgService = { membership: async () => ({ role: "OWNER" }) };
  const env = {
    KSEF_OWNER_USER_ID: "owner", KSEF_SYNC_ENABLED: "true",
    KSEF_DEHERUS_NIP: "1133200454", KSEF_DEHERUS_TOKEN: "test-only-token"
  };
  const service = new OrganizationFinanceService({ db, orgService, env });
  const status = await service.linkStatus("owner", "deherus");
  assert.equal(status.canLink, false);
  assert.match(status.explanation, /nie jest jeszcze gotowy/);
  await assert.rejects(service.linkPilot("owner", "deherus"), /nie została jeszcze uruchomiona/);
});
