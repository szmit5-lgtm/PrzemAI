"use strict";
const { readFileSync, writeFileSync } = require("node:fs");
const { build } = require("esbuild");

function apiOrigin(value) {
  if (!value) return "";
  const url = new URL(value);
  if (url.protocol !== "https:" || url.username || url.password ||
      url.search || url.hash || url.pathname !== "/") {
    throw new Error("PRZEMAI_MOBILE_API_ORIGIN musi być adresem HTTPS bez ścieżki i danych logowania.");
  }
  return url.origin;
}

if (require.main === module) {
  const origin = apiOrigin(process.env.PRZEMAI_MOBILE_API_ORIGIN);
  build({
    entryPoints: ["src/app.js"], outfile: "www/app.js", bundle: true, minify: true,
    format: "esm", target: ["safari15", "chrome100"],
    define: { PRZEMAI_API_ORIGIN: JSON.stringify(origin) }
  }).then(() => {
    const template = readFileSync("src/index.html", "utf8");
    writeFileSync("www/index.html", template.replace("__PRZEMAI_API_ORIGIN__", origin || "'none'"));
  }).catch(error => { console.error(error.message); process.exitCode = 1; });
}
module.exports = { apiOrigin };
