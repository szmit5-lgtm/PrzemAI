"use strict";

// No SDK is initialized here. Integrate a sender only after verified isolated staging.
// Explicit event and property allowlists prevent accidental message, invoice or PII capture.
const EVENT_PROPERTIES = Object.freeze({
  "api_health_checked": ["result", "component"],
  "ui_navigation": ["section"],
  "api_request_failed": ["status_bucket", "component"]
});
const ALLOWED_VALUES = Object.freeze({
  result: ["ok", "fail"],
  component: ["api", "worker", "frontend"],
  section: ["dashboard", "agents", "documents", "finance", "settings", "admin"],
  status_bucket: ["4xx", "5xx"]
});

function buildSafeEvent(name, properties = {}, env = process.env) {
  if (env.RAILWAY_ENVIRONMENT_NAME !== "staging" ||
      env.POSTHOG_SAFE_EVENTS_ENABLED !== "true" ||
      env.POSTHOG_HOST !== "https://eu.i.posthog.com") return null;
  if (typeof name !== "string" ||
      !Object.prototype.hasOwnProperty.call(EVENT_PROPERTIES, name) ||
      !properties || typeof properties !== "object" || Array.isArray(properties)) return null;
  const allowed = EVENT_PROPERTIES[name];
  // Reject, don't silently discard extra properties: callers need to see misconfiguration.
  if (Object.keys(properties).some(k => !allowed.includes(k))) return null;
  const clean = {};
  for (const [key, value] of Object.entries(properties)) {
    if (!ALLOWED_VALUES[key]?.includes(value)) return null;
    clean[key] = value;
  }
  return Object.freeze({ event: name, properties: Object.freeze(clean) });
}

module.exports = { buildSafeEvent };
