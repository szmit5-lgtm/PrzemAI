"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const page = fs.readFileSync(path.join(__dirname, "../frontend/src/app/company/[id]/investments/page.js"), "utf8");
test("assignment panel is gated on a successfully loaded membership list", () => {
  assert.match(page, /const \[membersLoaded, setMembersLoaded\] = useState\(false\)/);
  assert.match(page, /setMembers\(\[\]\); setMembersLoaded\(false\)/);
  assert.match(page, /Array\.isArray\(result\?\.data\)\) \{ setMembers\(result\.data\); setMembersLoaded\(true\); \}/);
  assert.match(page, /assignmentId===item\.id&&membersLoaded&&<AssignmentPanel/);
});
