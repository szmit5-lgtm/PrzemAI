// Run: node --test frontend/tests/analysisUploadKind.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../src/lib/analysisUploadKind.js", import.meta.url), "utf8");
const { getAnalysisUploadKind, validateAnalysisUploadFile } =
  await import("data:text/javascript;base64," + Buffer.from(source).toString("base64"));

test("document and meeting extensions are classified case-insensitively", () => {
  for (const ext of ["pdf", "docx", "txt"]) {
    assert.equal(getAnalysisUploadKind("report." + ext.toUpperCase()), "document");
  }
  for (const ext of ["mp3", "wav", "m4a", "ogg", "webm", "mpeg", "mp4"]) {
    assert.equal(getAnalysisUploadKind("recording." + ext.toUpperCase()), "meeting");
  }
});

test("missing, hidden and unsupported extensions are rejected", () => {
  for (const name of ["pdf", ".pdf", "report.", "report.exe", "", null, undefined]) {
    assert.throws(() => getAnalysisUploadKind(name), /Nieobsługiwany format/);
  }
});

test("empty, malformed and oversized files cannot be uploaded", () => {
  for (const size of [0, -1, NaN, Infinity, 1.5, undefined, 500 * 1024 * 1024 + 1]) {
    assert.throws(() => validateAnalysisUploadFile({ name: "report.pdf", size }));
  }
});

test("valid file sizes including the upper boundary are accepted", () => {
  assert.equal(validateAnalysisUploadFile({ name: "report.pdf", size: 1 }), "document");
  assert.equal(validateAnalysisUploadFile({ name: "recording.mp3", size: 500 * 1024 * 1024 }), "meeting");
});
