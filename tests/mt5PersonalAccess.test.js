const test = require("node:test");
const assert = require("node:assert/strict");
const { authorizePersonalMt5 } = require("../api/services/mt5PersonalAccess");

const owner = "user-private-owner";
const valid = { authenticatedUserId: owner, configuredOwnerUserId: owner };

test("MT5 personal: owner allowed without company context", () => {
  assert.deepEqual(authorizePersonalMt5(valid), { allowed: true });
});

test("MT5 personal: company member denied", () => {
  assert.equal(authorizePersonalMt5({ ...valid, authenticatedUserId: "company-user" }).allowed, false);
});

test("MT5 personal: no owner configured fails closed", () => {
  assert.equal(authorizePersonalMt5({ ...valid, configuredOwnerUserId: "" }).allowed, false);
});

test("MT5 personal: no authenticated user fails closed", () => {
  assert.equal(authorizePersonalMt5({ ...valid, authenticatedUserId: undefined }).allowed, false);
});

test("MT5 personal: company context forbidden even for owner", () => {
  assert.equal(authorizePersonalMt5({ ...valid, organizationId: "dekonica" }).allowed, false);
  assert.equal(authorizePersonalMt5({ ...valid, organizationId: "" }).allowed, false);
});
