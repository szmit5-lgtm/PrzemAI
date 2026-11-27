"use strict";
const assert = require("node:assert/strict");
const test = require("node:test");
const { reportRtf } = require("../api/services/ChatReportService");

test("RTF export encodes Polish text and escapes user formatting commands", () => {
  const rtf = reportRtf("Zażółć\r\n{\\object}");
  assert.match(rtf, /^\{\\rtf1/);
  assert.ok(rtf.includes("Za\\u380?\\u243?\\u322?\\u263?"));
  assert.ok(rtf.includes("\\par\n\\{\\\\object\\}"));
});
