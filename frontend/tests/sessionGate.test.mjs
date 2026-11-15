import test from "node:test";
import assert from "node:assert/strict";
import { hasUsableSessionToken } from "../src/lib/sessionGate.mjs";

test("missing or blank stored token is not a session", () => {
  for (const token of [null, undefined, "", " ", "  \\n"]) {
    assert.equal(hasUsableSessionToken({ getItem: () => token }), false);
  }
});

test("nonempty token is sent for server verification, not trusted locally", () => {
  assert.equal(hasUsableSessionToken({ getItem: () => "synthetic.jwt.value" }), true);
});

test("unavailable browser storage fails closed without throwing", () => {
  assert.equal(hasUsableSessionToken(null), false);
  assert.equal(hasUsableSessionToken({ getItem() { throw new Error("blocked"); } }), false);
});
