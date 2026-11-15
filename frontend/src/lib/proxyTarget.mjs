// Resolve the API rewrite without ever silently routing a hosted frontend to its own localhost.
// This function is intentionally independent of Next.js so it can be tested with node:test.
export function resolveApiProxyTarget(env = {}) {
  const configured = typeof env.API_PROXY_TARGET === "string" ? env.API_PROXY_TARGET.trim() : "";
  const hosted = Boolean(env.VERCEL || env.RAILWAY_ENVIRONMENT_ID);
  if (!configured && hosted) {
    throw new Error("API_PROXY_TARGET is required for hosted builds; refusing localhost fallback.");
  }
  const target = configured || "http://localhost:3000";
  let parsed;
  try {
    parsed = new URL(target);
  } catch {
    throw new Error("API_PROXY_TARGET must be an absolute HTTP(S) origin.");
  }
  if (!["http:", "https:"].includes(parsed.protocol) ||
      parsed.username || parsed.password || parsed.search || parsed.hash ||
      parsed.pathname !== "/" || parsed.origin === "null") {
    throw new Error("API_PROXY_TARGET must be an HTTP(S) origin without credentials, path, query or fragment.");
  }
  if (hosted && parsed.protocol !== "https:") {
    throw new Error("API_PROXY_TARGET must use HTTPS on hosted builds.");
  }
  return parsed.origin;
}
