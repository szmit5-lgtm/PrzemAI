/** @type {import('next').NextConfig} */
const backend = process.env.API_PROXY_TARGET || "http://localhost:3000";
const parsed = new URL(backend);
if (!["http:", "https:"].includes(parsed.protocol) || parsed.username || parsed.password || parsed.search || parsed.hash) {
  throw new Error("API_PROXY_TARGET must be a valid HTTP(S) origin without credentials.");
}

const buildSha = process.env.VERCEL_GIT_COMMIT_SHA || "";
const buildLabel = /^[a-f0-9]{40}$/i.test(buildSha) ? buildSha.slice(0, 7) : "lokalna";

const nextConfig = {
  env: { NEXT_PUBLIC_PRZEMAI_BUILD: buildLabel },
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${parsed.origin}/api/:path*` }];
  }
};

export default nextConfig;
