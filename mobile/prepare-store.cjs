"use strict";
const { spawnSync } = require("node:child_process");
const { apiOrigin } = require("./build.cjs");

if (process.env.PRZEMAI_MOBILE_STAGING_ORIGIN || !apiOrigin(process.env.PRZEMAI_MOBILE_API_ORIGIN)) {
  throw Error("Build sklepowy wymaga PRZEMAI_MOBILE_API_ORIGIN i lokalnie spakowanego interfejsu.");
}
const result = spawnSync("npm", ["run", "sync"], { stdio: "inherit", shell: process.platform === "win32" });
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
