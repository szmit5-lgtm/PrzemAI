const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const jwt = require("jsonwebtoken");
const http = require("node:http");

// Exercise actual Express routes and JWT middleware, with an in-memory Prisma stub.
const prismaPath = require.resolve("../lib/prisma");
const previous = require.cache[prismaPath];
let reads = 0;
let writes = 0;
require.cache[prismaPath] = {
  id: prismaPath, filename: prismaPath, loaded: true,
  exports: {
    personalMt5Snapshot: {
      findMany: async () => { reads++; return []; },
      upsert: async () => { writes++; return { id: "snapshot-test" }; }
    }
  }
};
const routes = require("../api/routes/mt5PersonalRoutes");
if (previous) require.cache[prismaPath] = previous;
else delete require.cache[prismaPath];

const snapshot = {
  source: "MT5_LOCAL", mode: "REAL", readOnly: true,
  asOf: new Date().toISOString(), currency: "EUR",
  balance: 3.24, equity: 3.24, positionCount: 0, positions: []
};

async function serve(fn) {
  const app = express();
  app.use(express.json());
  app.use("/api/mt5/personal", routes);
  const server = http.createServer(app);
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  try { await fn("http://127.0.0.1:" + server.address().port); }
  finally { await new Promise(resolve => server.close(resolve)); }
}
function token(userId) {
  return "Bearer " + jwt.sign({ id: userId }, process.env.JWT_SECRET);
}
async function request(url, path, userId, method = "GET", body, headers = {}) {
  return fetch(url + "/api/mt5/personal" + path, {
    method,
    headers: { ...(userId ? { authorization: token(userId) } : {}),
      ...(body ? { "content-type": "application/json" } : {}), ...headers },
    ...(body ? { body: JSON.stringify(body) } : {})
  });
}
test("MT5 route: disabled by default and rejects missing auth", async () => {
  process.env.JWT_SECRET = "mt5-test-secret";
  delete process.env.MT5_PERSONAL_READONLY_ENABLED;
  process.env.MT5_PERSONAL_OWNER_USER_ID = "owner";
  await serve(async url => {
    assert.equal((await request(url, "/snapshots", "owner")).status, 503);
    assert.equal((await request(url, "/snapshots")).status, 401);
  });
});
test("MT5 route: company user and company context denied", async () => {
  process.env.JWT_SECRET = "mt5-test-secret";
  process.env.MT5_PERSONAL_READONLY_ENABLED = "true";
  process.env.MT5_PERSONAL_OWNER_USER_ID = "owner";
  await serve(async url => {
    assert.equal((await request(url, "/snapshots", "company-user")).status, 403);
    assert.equal((await request(url, "/snapshots", "owner", "GET", undefined,
      { "x-organization-id": "dekonica" })).status, 403);
    assert.equal((await request(url, "/snapshots?organizationId=deherus", "owner")).status, 403);
  });
});
test("MT5 route: read-only owner can read, cannot ingest until separately enabled", async () => {
  process.env.JWT_SECRET = "mt5-test-secret";
  process.env.MT5_PERSONAL_READONLY_ENABLED = "true";
  process.env.MT5_PERSONAL_OWNER_USER_ID = "owner";
  delete process.env.MT5_PERSONAL_INGEST_ENABLED;
  await serve(async url => {
    assert.equal((await request(url, "/snapshots", "owner")).status, 200);
    assert.equal((await request(url, "/snapshots", "owner", "POST", snapshot)).status, 503);
  });
  assert.equal(writes, 0);
  assert.ok(reads > 0);
});
test("MT5 route: ingestion rejects malformed payload and accepts sanitized snapshot", async () => {
  process.env.JWT_SECRET = "mt5-test-secret";
  process.env.MT5_PERSONAL_READONLY_ENABLED = "true";
  process.env.MT5_PERSONAL_OWNER_USER_ID = "owner";
  process.env.MT5_PERSONAL_INGEST_ENABLED = "true";
  await serve(async url => {
    assert.equal((await request(url, "/snapshots", "owner", "POST", { ...snapshot, password: "secret" })).status, 400);
    assert.equal((await request(url, "/snapshots", "owner", "POST", snapshot)).status, 201);
  });
  assert.equal(writes, 1);
});
