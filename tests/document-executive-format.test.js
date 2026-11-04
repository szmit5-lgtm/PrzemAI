const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");

const source = fs.readFileSync(path.join(__dirname, "../api/services/DocumentService.js"), "utf8");
const sandbox = {
  module: { exports: {} },
  require(id) {
    if (id === "node:fs/promises") return {};
    if (id === "node:path") return path;
    if (id.endsWith("DocumentEngine")) return class {};
    if (id.endsWith("AIEngine")) return class {};
    throw new Error("Unexpected import: " + id);
  }
};
vm.runInNewContext(source, sandbox, { filename: "DocumentService.js" });
const service = sandbox.module.exports;

test("executive report limits lists without mutating input", () => {
  const report = {
    summary: "Podsumowanie",
    keyInformation: Array.from({ length: 8 }, (_, i) => "Fakt " + i),
    dates: Array.from({ length: 8 }, (_, i) => "Termin " + i),
    risks: ["a", "b", "c", "d"],
    recommendations: ["a", "b", "c", "d"],
    actionItems: Array.from({ length: 7 }, (_, i) => ({ title: "Zadanie " + i, priority: "INVALID" }))
  };
  const result = service.formatExecutiveReport(report);
  assert.equal(result.summary, report.summary);
  assert.equal(result.keyInformation.length, 5);
  assert.equal(result.dates.length, 5);
  assert.equal(result.risks.length, 3);
  assert.equal(result.recommendations.length, 3);
  assert.equal(result.actionItems.length, 5);
  assert.equal(result.actionItems[0].priority, "MEDIUM");
  assert.equal(report.actionItems.length, 7);
  assert.equal(report.actionItems[0].priority, "INVALID");
});

test("executive report preserves missing fields and null", () => {
  assert.equal(service.formatExecutiveReport(null), null);
  const result = service.formatExecutiveReport({ summary: "OK" });
  assert.equal(result.summary, "OK");
  assert.equal(result.actionItems, undefined);
});
