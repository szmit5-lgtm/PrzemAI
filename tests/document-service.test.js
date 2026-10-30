"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "../api/services/DocumentService.js"), "utf8");

function documentService({ extractedText, extractionError, response } = {}) {
  const calls = { extracted: [], ai: [] };
  class DocumentEngine {
    async extractText(filePath) {
      calls.extracted.push(filePath);
      if (extractionError) throw extractionError;
      return extractedText;
    }
  }
  class AIEngine {
    async ask(options) {
      calls.ai.push(options);
      return response;
    }
  }
  const dependencies = {
    "../../core/document/DocumentEngine": DocumentEngine,
    "../../core/ai/AIEngine": AIEngine
  };
  const context = {
    module: { exports: {} },
    require(name) {
      assert.ok(Object.hasOwn(dependencies, name), `unexpected dependency: ${name}`);
      return dependencies[name];
    }
  };
  vm.runInNewContext(source, context, { filename: "DocumentService.js" });
  return { service: context.module.exports, calls };
}

test("document analysis rejects empty extracted text without calling AI", async () => {
  for (const extractedText of ["", " \n\t ", null]) {
    const { service, calls } = documentService({ extractedText });
    await assert.rejects(service.analyze("empty.pdf"), /Nie udało się odczytać treści dokumentu/);
    assert.deepEqual(calls.extracted, ["empty.pdf"]);
    assert.equal(calls.ai.length, 0);
  }
});

test("document analysis requests structured JSON and preserves extracted source text", async () => {
  const text = "Umowa: zapłata 5 000 zł do 15 listopada 2026 r.";
  const report = { summary: "Umowa", actionItems: [{ title: "Zapłacić", priority: "HIGH", dueDate: null }] };
  const { service, calls } = documentService({ extractedText: text, response: report });
  const result = await service.analyze("agreement.docx");
  assert.equal(result, report);
  assert.deepEqual(calls.extracted, ["agreement.docx"]);
  assert.equal(calls.ai.length, 1);
  assert.equal(calls.ai[0].json, true);
  assert.match(calls.ai[0].system, /JSON/);
  assert.ok(calls.ai[0].user.includes(text), "prompt must include the original extracted text");
  assert.match(calls.ai[0].user, /actionItems/);
});

test("document extraction failure is propagated without invoking AI", async () => {
  const error = new Error("PDF parsing failed");
  const { service, calls } = documentService({ extractionError: error });
  await assert.rejects(service.analyze("broken.pdf"), err => err === error);
  assert.equal(calls.ai.length, 0);
});
