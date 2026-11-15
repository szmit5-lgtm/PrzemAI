// Read-only staging smoke check: never logs in, uploads, or mutates server state.
// Usage: node scripts/staging-auth-smoke.mjs https://isolated-staging.example.test
export async function checkStagingAuth(origin, fetchImpl = fetch) {
  const url = new URL(origin);
  if (url.protocol !== "https:" || url.username || url.password ||
      url.pathname !== "/" || url.search || url.hash ||
      ["localhost", "127.0.0.1"].includes(url.hostname)) {
    throw new Error("An explicit isolated HTTPS staging origin is required");
  }
  const request = async path => {
    const response = await fetchImpl(new URL(path, url), {
      method: "GET", redirect: "manual",
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(8000)
    });
    const body = await response.text();
    let data;
    try { data = JSON.parse(body); } catch { throw new Error(path + ": non-JSON response"); }
    return { status: response.status, data };
  };
  const health = await request("/health");
  if (health.status !== 200 || health.data?.status !== "ok") {
    throw new Error("/health failed");
  }
  const auth = await request("/api/auth/me");
  if (auth.status !== 401 || auth.data?.success !== false) {
    throw new Error("/api/auth/me must reject an anonymous request with 401");
  }
  return { health: "PASS", anonymousAuth: "PASS" };
}

if (process.argv[1] && import.meta.url === new URL("file://" + process.argv[1]).href) {
  checkStagingAuth(process.argv[2] || "").then(
    result => console.log(JSON.stringify(result)),
    error => { console.error("FAIL:", error.message); process.exitCode = 1; }
  );
}
