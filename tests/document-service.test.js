"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "../api/services/DocumentService.js"), "utf8");

function documentService({ extractedText, extractionError, response, scannedFile } = {}) {
  const calls = { extracted: [], ai: [], scanned: [] };
  class DocumentEngine {
    async extractText(filePath) {
      calls.extracted.push(filePath);
      if (extractionError) throw extractionError;
      return extractedText;
    }
  }
  class AIEngine {
    constructor() { this.client = { responses: { create: async options => { calls.scanned.push(options); return { output_text: JSON.stringify(response) }; } } }; }
    async ask(options) {
      calls.ai.push(options);
      return response;
    }
  }
  const dependencies = {
    "../../core/document/DocumentEngine": DocumentEngine,
    "../../core/ai/AIEngine": AIEngine,
    "node:fs/promises": { readFile: async () => scannedFile ?? Buffer.from("%PDF-1.4 scanned") },
    "node:path": path
  };
  const context = {
    module: { exports: {} },
    Buffer,
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
    await assert.rejects(service.analyze("empty.txt"), /Nie znaleziono tekstu w dokumencie/);
    assert.deepEqual(calls.extracted, ["empty.txt"]);
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


test("scanned PDF is sent to multimodal analysis when text extraction is empty", async () => {
  const report = { summary: "Odczytany skan", actionItems: [] };
  const { service, calls } = documentService({ extractedText: "", response: report });
  const result = await service.analyze("scan.pdf");
  assert.deepEqual(JSON.parse(JSON.stringify(result)), report);
  assert.equal(calls.ai.length, 0);
  assert.equal(calls.scanned.length, 1);
  const attachment = calls.scanned[0].input[1].content[1];
  assert.equal(attachment.type, "input_file");
  assert.match(attachment.file_data, /^data:application\/pdf;base64,/);
});


test("oversized scanned PDF is rejected before sending data to AI", async () => {
  const { service, calls } = documentService({
    extractedText: "",
    scannedFile: Buffer.alloc(20 * 1024 * 1024 + 1)
  });
  await assert.rejects(service.analyze("oversized.pdf"), /20 MB/);
  assert.equal(calls.scanned.length, 0);
  assert.equal(calls.ai.length, 0);
});

test("scanned PDF reports malformed AI JSON without returning a false success", async () => {
  const { service, calls } = documentService({ extractedText: "", response: null });
  service.ai.client.responses.create = async options => {
    calls.scanned.push(options);
    return { output_text: "not valid JSON" };
  };
  await assert.rejects(service.analyze("scan.pdf"), /Nie udało się przeanalizować skanu PDF/);
  assert.equal(calls.scanned.length, 1);
  assert.equal(calls.ai.length, 0);
});
