/** @type {import('next').NextConfig} */
import { resolveApiProxyTarget } from "./src/lib/proxyTarget.mjs";

// A hosted preview without a configured backend must fail its build, not
// silently rewrite authenticated requests to an unreachable localhost.
const backendOrigin = resolveApiProxyTarget(process.env);

const validSha = sha => /^[a-f0-9]{40}$/i.test(sha || "");
const buildSha = [process.env.VERCEL_GIT_COMMIT_SHA, process.env.RAILWAY_GIT_COMMIT_SHA].find(validSha) || "";
const buildLabel = buildSha ? buildSha.slice(0, 7) : "lokalna";

const nextConfig = {
  env: { NEXT_PUBLIC_PRZEMAI_BUILD: buildLabel },
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${backendOrigin}/api/:path*` }];
  }
};

export default nextConfig;
