"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { buildSafeEvent } = require("../lib/safeTelemetry");

const staging = Object.freeze({
  RAILWAY_ENVIRONMENT_NAME: "staging",
  POSTHOG_SAFE_EVENTS_ENABLED: "true",
  POSTHOG_HOST: "https://eu.i.posthog.com"
});

test("no telemetry outside explicitly enabled EU staging", () => {
  assert.equal(buildSafeEvent("api_health_checked", { result: "ok" }, {}), null);
  assert.equal(buildSafeEvent("api_health_checked", { result: "ok" }, { ...staging, RAILWAY_ENVIRONMENT_NAME: "production" }), null);
  assert.equal(buildSafeEvent("api_health_checked", { result: "ok" }, { ...staging, POSTHOG_HOST: "https://us.i.posthog.com" }), null);
  assert.equal(buildSafeEvent("api_health_checked", { result: "ok" }, { ...staging, POSTHOG_SAFE_EVENTS_ENABLED: "false" }), null);
});

test("only known low-cardinality event dimensions are accepted", () => {
  assert.deepEqual(buildSafeEvent("api_request_failed", { status_bucket: "5xx", component: "api" }, staging), {
    event: "api_request_failed", properties: { status_bucket: "5xx", component: "api" }
  });
  assert.equal(buildSafeEvent("invoice_opened", {}, staging), null);
  assert.equal(buildSafeEvent("ui_navigation", { section: "admin", email: "person@example.invalid" }, staging), null);
  assert.equal(buildSafeEvent("api_request_failed", { status_bucket: "500" }, staging), null);
  assert.equal(buildSafeEvent("ui_navigation", { section: "/documents/secret-id" }, staging), null);
  assert.equal(buildSafeEvent("ui_navigation", { message: "private document content" }, staging), null);
});
