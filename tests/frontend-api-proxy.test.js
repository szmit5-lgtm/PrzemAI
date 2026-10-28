const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

test("frontend auth requests use the same-origin API proxy", () => {
  const file = fs.readFileSync(path.join(__dirname, "../frontend/src/lib/api.js"), "utf8");
  const activeCode = file
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("//"))
    .join("\n");

  assert.match(activeCode, /^const API_URL = ["']{2};$/m);
  assert.match(activeCode, /fetch\(\x60\$\{API_URL\}\$\{endpoint\}\x60/);
  assert.doesNotMatch(activeCode, /process\.env\.NEXT_PUBLIC_API_URL/);
});
