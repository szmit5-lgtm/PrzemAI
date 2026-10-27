/** @type {import('next').NextConfig} */
const backend = process.env.API_PROXY_TARGET || "http://localhost:3000";
const parsed = new URL(backend);
if (!["http:", "https:"].includes(parsed.protocol) || parsed.username || parsed.password || parsed.search || parsed.hash) {
  throw new Error("API_PROXY_TARGET must be a valid HTTP(S) origin without credentials.");
}

const nextConfig = {
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${parsed.origin}/api/:path*` }];
  }
};

export default nextConfig;
