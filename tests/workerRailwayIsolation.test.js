const test = require("node:test");
const assert = require("node:assert/strict");
const { checkWorkerRailwayIsolation: check } = require("../lib/workerRailwayIsolation");

test("staging worker in production environment is blocked", () => {
  assert.deepEqual(check({ RAILWAY_ENVIRONMENT_NAME:"production", RAILWAY_SERVICE_NAME:"PrzemAI-worker-staging" }),
    { ok:false, reason:"staging_worker_in_production_environment" });
});
test("production worker in staging environment is blocked", () => {
  assert.equal(check({ RAILWAY_ENVIRONMENT_NAME:"staging", RAILWAY_SERVICE_NAME:"PrzemAI-worker-production" }).ok,false);
});
test("matching production and staging worker names are allowed", () => {
  assert.equal(check({ RAILWAY_ENVIRONMENT_NAME:"production", RAILWAY_SERVICE_NAME:"PrzemAI-worker-production" }).ok,true);
  assert.equal(check({ RAILWAY_ENVIRONMENT_NAME:"staging", RAILWAY_SERVICE_NAME:"PrzemAI-worker-staging" }).ok,true);
});
test("unknown service name in Railway is denied", () => {
  assert.equal(check({ RAILWAY_ENVIRONMENT_NAME:"production" }).ok,false);
});
test("local tests remain available without Railway metadata", () => {
  assert.equal(check({ NODE_ENV:"test" }).ok,true);
});
