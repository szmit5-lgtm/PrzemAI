"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const mammoth = require("mammoth");
const { readSheet } = require("read-excel-file/node");
const { reportFor } = require("../api/services/ChatReportService");
const { exportChatReport } = require("../api/services/ChatReportExport");

const text = "# Raport PrzemAI\nZażółć gęślą jaźń\n=2+2\nKońcowy wiersz";

test("Word export preserves Polish text and paragraphs", async () => {
  const file = await exportChatReport("docx", text);
  assert.equal(file.filename, "raport-przemai.docx");
  const opened = await mammoth.extractRawText({ buffer: file.body });
  assert.deepEqual(opened.value.trim().split("\n\n"), ["Raport PrzemAI", "Zażółć gęślą jaźń", "=2+2", "Końcowy wiersz"]);
});

test("Excel export preserves text and treats formula-like lines as literal cells", async () => {
  const file = await exportChatReport("xlsx", text);
  assert.equal(file.filename, "raport-przemai.xlsx");
  assert.deepEqual(await readSheet(file.body), [["Raport PrzemAI"], ["Zażółć gęślą jaźń"], ["=2+2"], ["Końcowy wiersz"]]);
});

test("PDF uses an embedded font and paginates long reports", async () => {
  const file = await exportChatReport("pdf", text + "\n" + "Dodatkowy wiersz.\n".repeat(200));
  assert.equal(file.contentType, "application/pdf");
  const pdf = file.body.toString("latin1");
  assert.match(pdf, /^%PDF-/);
  assert.match(pdf, /\/ToUnicode \d+ 0 R/);
  assert.ok((pdf.match(/\/Type \/Page\b/g) || []).length > 1);
  assert.equal(await exportChatReport("html", text), null);
});

test("export input is restricted to visible, finished assistant messages", async () => {
  const chat = { getConversation: async (user, id) => user === "owner" && id === "thread"
    ? { messages: [
      { id: "visible", role: "assistant", content: "Dane. password: hidden" },
      { id: "restricted", role: "assistant", content: "Dane.", metadata: { restricted: true } },
      { id: "pending", role: "assistant", content: "Dane.", metadata: { pending: true } },
      { id: "user", role: "user", content: "Pytanie." }
    ] } : null };
  for (const id of ["restricted", "pending", "user"]) assert.equal(await reportFor(chat, "owner", "thread", id), null);
  assert.equal(await reportFor(chat, "other", "thread", "visible"), null);
  assert.doesNotMatch((await reportFor(chat, "owner", "thread", "visible")).text, /password: hidden/);
});
