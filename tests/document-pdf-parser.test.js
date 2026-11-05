"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(
  path.join(__dirname, "../core/document/DocumentEngine.js"),
  "utf8"
);

test("PDF extraction passes file bytes to parser and returns extracted text", async () => {
  const filePath = "/tmp/contract.pdf";
  const bytes = Buffer.from("%PDF-1.4 test");
  const calls = [];
  const context = {
    module: { exports: {} },
    console: { log() {} },
    require(name) {
      if (name === "fs") return { promises: { readFile: async (p) => {
        assert.equal(p, filePath);
        return bytes;
      } } };
      if (name === "path") return path;
      if (name === "pdf-parse") return async (buffer) => {
        calls.push(buffer);
        return { text: "Umowa: 5 000 zł" };
      };
      if (name === "mammoth") return {};
      throw new Error("Unexpected dependency: " + name);
    }
  };
  vm.runInNewContext(source, context, { filename: "DocumentEngine.js" });
  const engine = new context.module.exports();
  assert.equal(await engine.extractText(filePath), "Umowa: 5 000 zł");
  assert.equal(calls.length, 1);
  assert.equal(calls[0], bytes);
});
