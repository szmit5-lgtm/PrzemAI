"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const configUrl = pathToFileURL(path.join(__dirname, "../frontend/next.config.mjs")).href;
let importNumber = 0;

async function loadConfig(target) {
  const previous = process.env.API_PROXY_TARGET;
  if (target === null) delete process.env.API_PROXY_TARGET;
  else process.env.API_PROXY_TARGET = target;

  try {
    // A unique URL forces Node to evaluate the config with this test's env.
    return (await import(`${configUrl}?test=${++importNumber}`)).default;
  } finally {
    if (previous === undefined) delete process.env.API_PROXY_TARGET;
    else process.env.API_PROXY_TARGET = previous;
  }
}

test("Next.js proxies /api to the configured HTTPS backend origin", async () => {
  const config = await loadConfig("https://backend.example.test:8443");
  assert.deepEqual(await config.rewrites(), [
    { source: "/api/:path*", destination: "https://backend.example.test:8443/api/:path*" }
  ]);
});

test("Next.js uses localhost only when no API proxy target is configured", async () => {
  const config = await loadConfig(null);
  assert.deepEqual(await config.rewrites(), [
    { source: "/api/:path*", destination: "http://localhost:3000/api/:path*" }
  ]);
});

test("Next.js rejects non-HTTP API proxy targets", async () => {
  await assert.rejects(loadConfig("file:///etc/passwd"), /API_PROXY_TARGET/);
});

test("Next.js rejects credentials embedded in API proxy target", async () => {
  await assert.rejects(loadConfig("https://user:password@backend.example.test"), /API_PROXY_TARGET/);
});

test("Next.js exposes a short non-secret frontend build identifier", async () => {
  const previous = process.env.VERCEL_GIT_COMMIT_SHA;
  const previousRailway = process.env.RAILWAY_GIT_COMMIT_SHA;
  delete process.env.RAILWAY_GIT_COMMIT_SHA;
  try {
    process.env.VERCEL_GIT_COMMIT_SHA = "abcdef0123456789abcdef0123456789abcdef01";
    const config = await loadConfig(null);
    assert.equal(config.env.NEXT_PUBLIC_PRZEMAI_BUILD, "abcdef0");

    process.env.VERCEL_GIT_COMMIT_SHA = "not-a-commit";
    const fallback = await loadConfig(null);
    assert.equal(fallback.env.NEXT_PUBLIC_PRZEMAI_BUILD, "lokalna");
  } finally {
    if (previous === undefined) delete process.env.VERCEL_GIT_COMMIT_SHA;
    else process.env.VERCEL_GIT_COMMIT_SHA = previous;
    if (previousRailway === undefined) delete process.env.RAILWAY_GIT_COMMIT_SHA;
    else process.env.RAILWAY_GIT_COMMIT_SHA = previousRailway;
  }
});


test("Next.js shows the Railway Git revision on Railway staging", async () => {
  const previousVercel = process.env.VERCEL_GIT_COMMIT_SHA;
  const previousRailway = process.env.RAILWAY_GIT_COMMIT_SHA;
  try {
    delete process.env.VERCEL_GIT_COMMIT_SHA;
    process.env.RAILWAY_GIT_COMMIT_SHA = "0123456789abcdef0123456789abcdef01234567";
    const railway = await loadConfig(null);
    assert.equal(railway.env.NEXT_PUBLIC_PRZEMAI_BUILD, "0123456");

    process.env.VERCEL_GIT_COMMIT_SHA = "abcdef0123456789abcdef0123456789abcdef01";
    const vercel = await loadConfig(null);
    assert.equal(vercel.env.NEXT_PUBLIC_PRZEMAI_BUILD, "abcdef0");

    process.env.VERCEL_GIT_COMMIT_SHA = "invalid";
    const invalidVercel = await loadConfig(null);
    assert.equal(invalidVercel.env.NEXT_PUBLIC_PRZEMAI_BUILD, "0123456");
  } finally {
    if (previousVercel === undefined) delete process.env.VERCEL_GIT_COMMIT_SHA;
    else process.env.VERCEL_GIT_COMMIT_SHA = previousVercel;
    if (previousRailway === undefined) delete process.env.RAILWAY_GIT_COMMIT_SHA;
    else process.env.RAILWAY_GIT_COMMIT_SHA = previousRailway;
  }
});
