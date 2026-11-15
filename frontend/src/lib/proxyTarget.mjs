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
  // A public Vercel/Railway build must never proxy authentication requests to
  // its own loopback interface or a local network address by misconfiguration.
  // IPv6 literals are rejected for hosted rewrites to avoid mapped IPv4,
  // unique-local and link-local bypasses. Public IPv6 remains available via DNS.
  // Internal Railway DNS is intentionally not rejected: it may be used when
  // the frontend and API share a genuinely isolated private network.
  if (hosted) {
    const host = parsed.hostname.toLowerCase().replace(/\.$/, "");
    const ipv4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
    const privateV4 = ipv4 && (() => {
      const a = ipv4.slice(1).map(Number);
      return a.every(x => x <= 255) && (a[0] === 10 || a[0] === 127 ||
        a[0] === 0 || (a[0] === 100 && a[1] >= 64 && a[1] <= 127) ||
        (a[0] === 169 && a[1] === 254) ||
        (a[0] === 198 && (a[1] === 18 || a[1] === 19)) ||
        a[0] >= 224 ||
        (a[0] === 192 && a[1] === 168) ||
        (a[0] === 172 && a[1] >= 16 && a[1] <= 31));
    })();
    if (host === "localhost" || host.endsWith(".localhost") ||
        host === "localhost.localdomain" || host.endsWith(".localhost.localdomain") ||
        host === "localdomain" || host.endsWith(".local") ||
        host.startsWith("[") || privateV4) {
      throw new Error("API_PROXY_TARGET cannot target a loopback or private IP on hosted builds.");
    }
  }
  return parsed.origin;
}
