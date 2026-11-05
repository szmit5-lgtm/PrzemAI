"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const FinancialAgent = require("../agents/financial/FinancialAgent");

test("financial agent rejects absent or malformed tenant IDs before querying integrations", async () => {
  const agent = new FinancialAgent();
  for (const userId of [undefined, null, "", " ", " user-1", "user-1 ", 42, {}, []]) {
    await assert.rejects(
      agent.run({ userId }),
      /requires an authenticated user ID/
    );
  }
});
