import test from "node:test";
import assert from "node:assert/strict";
import { checkStagingAuth } from "../scripts/staging-auth-smoke.mjs";

const fakeFetch = (healthStatus = 200, authStatus = 401) => async url => ({
  status: url.pathname === "/health" ? healthStatus : authStatus,
  text: async () => JSON.stringify(url.pathname === "/health"
    ? { success: true, status: "ok" }
    : { success: false, error: "Brak tokena." })
});

test("anonymous staging auth smoke succeeds only for healthy API and 401", async () => {
  assert.deepEqual(await checkStagingAuth("https://staging.example.test/", fakeFetch()),
    { health: "PASS", anonymousAuth: "PASS" });
});
test("rejects staging without working health", async () => {
  await assert.rejects(checkStagingAuth("https://staging.example.test/", fakeFetch(503)));
});
test("rejects accidental anonymous auth access", async () => {
  await assert.rejects(checkStagingAuth("https://staging.example.test/", fakeFetch(200, 200)));
});
test("rejects local and insecure URLs without making requests", async () => {
  for (const url of ["http://staging.example.test", "https://localhost", "https://127.0.0.1", "https://staging.example.test/path"]) {
    await assert.rejects(checkStagingAuth(url, () => { throw Error("must not call"); }));
  }
});
