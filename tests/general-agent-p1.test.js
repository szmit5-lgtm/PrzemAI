"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const { createRequire } = require("node:module");
const { extractAttachment } = require("../api/services/ChatAttachmentService");
const { prepare, confirm, reportFor } = require("../api/services/ChatReportService");
const { transcribeTelegramVoice } = require("../api/services/TelegramVoiceService");
const Zip = createRequire(require.resolve("mammoth"))("jszip");

async function workbook() {
  const zip = new Zip();
  zip.file("[Content_Types].xml", `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
    <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
    <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  </Types>`);
  zip.file("xl/workbook.xml", `<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"
    xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>
    <sheet name="Koszty" sheetId="1" r:id="rId1"/></sheets></workbook>`);
  zip.file("xl/_rels/workbook.xml.rels", `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
    <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
    </Relationships>`);
  zip.file("xl/worksheets/sheet1.xml", `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
    <sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>Budżet</t></is></c>
    <c r="B1"><v>123</v></c></row></sheetData></worksheet>`);
  return zip.generateAsync({ type: "nodebuffer" });
}

test("reads real XLSX cell values, constrains uploads and redacts OCR output", async () => {
  const sheet = await extractAttachment({ originalname: "koszty.xlsx", buffer: await workbook() });
  assert.match(sheet.text, /Budżet \| 123/);
  const photo = await extractAttachment({ originalname: "foto.png", buffer: Buffer.from("photo") }, {
    ocr: async bytes => {
      assert.equal(bytes.toString(), "photo");
      return "Faktura\nOPENAI_API_KEY=sk-test-123456789";
    }
  });
  assert.match(photo.text, /Faktura/);
  assert.doesNotMatch(photo.text, /sk-test/);
  await assert.rejects(extractAttachment({ originalname: "broken.xlsx", buffer: Buffer.from("not a zip") }));
  await assert.rejects(extractAttachment({ originalname: "large.pdf", buffer: Buffer.alloc(5 * 1024 * 1024) }));
});

test("extracts a genuine DOCX text document", async () => {
  const zip = new Zip();
  zip.file("[Content_Types].xml", `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
    <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  </Types>`);
  zip.file("_rels/.rels", `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
    <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
  </Relationships>`);
  zip.file("word/document.xml", `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
    <w:body><w:p><w:r><w:t>Termin zapłaty 30 dni</w:t></w:r></w:p></w:body></w:document>`);
  const result = await extractAttachment({ originalname: "umowa.docx",
    buffer: await zip.generateAsync({ type: "nodebuffer" }) });
  assert.match(result.text, /Termin zapłaty 30 dni/);
});

test("voice downloads are bounded and a mock transcriber receives only verified OGG", async () => {
  const voice = { file_id: "file1", duration: 3, file_size: 16 };
  const calls = [];
  const text = await transcribeTelegramVoice(voice, { token: "mock",
    fetchRequest: async (url, options) => {
      calls.push(new URL(url));
      assert.equal(options.redirect, "error");
      return calls.length === 1 ? Response.json({ result: { file_path: "voice/file_1.oga" } })
        : new Response(Buffer.from("OggS synthetic"));
    },
    transcriber: { transcribe: async ({ buffer, contentType }) => {
      assert.match(buffer.toString(), /^OggS/);
      assert.equal(contentType, "audio/ogg");
      return "kontynuuj analizę";
    } }
  });
  assert.equal(text, "kontynuuj analizę");
  assert.ok(calls.every(url => url.hostname === "api.telegram.org"));
  await assert.rejects(transcribeTelegramVoice({ ...voice, duration: 61 }, { token: "mock",
    fetchRequest: () => assert.fail("overlong audio must not download") }));
});

test("Telegram share approval is private, bound to report and single-use under concurrency", async () => {
  let message = { role: "assistant", id: "reply", content: "Raport prywatny" };
  let binding = true;
  const records = new Map();
  const telegram = { userId: "owner", report: { status: "LINKED", telegramUserId: "42" } };
  const db = { history: {
    findFirst: async ({ where }) => where.type === "TELEGRAM_LINK" ? (binding ? telegram : null)
      : (records.get(where.id)?.userId === where.userId ? records.get(where.id) : null),
    create: async ({ data }) => records.set(data.id, structuredClone(data)),
    updateMany: async ({ where, data }) => {
      const existing = records.get(where.id);
      if (existing.report.state !== where.report.equals) return { count: 0 };
      existing.report = data.report;
      return { count: 1 };
    }
  } };
  const chat = { getConversation: async (userId, id) => userId === "owner" && id === "chat"
    ? { messages: [message] } : null };
  let sends = 0;
  const options = { db, chat, userId: "owner", conversationId: "chat", messageId: "reply",
    send: async ({ text, chatId }) => { assert.match(text, /Raport prywatny/); assert.equal(chatId, "42"); sends++; } };
  assert.equal(await reportFor(chat, "other", "chat", "reply"), null);
  const { id } = await prepare(options);
  assert.equal(sends, 0);
  const outcomes = await Promise.all([confirm({ ...options, id }), confirm({ ...options, id })]);
  assert.equal(outcomes.filter(Boolean).length, 1);
  assert.equal(sends, 1);
  const changed = await prepare(options);
  message = { ...message, content: "Inna treść" };
  assert.equal(await confirm({ ...options, id: changed.id }), false);
  const rebound = await prepare(options);
  telegram.report.telegramUserId = "43";
  assert.equal(await confirm({ ...options, id: rebound.id }), false);
  telegram.report.telegramUserId = "42";
  const revoked = await prepare(options);
  binding = false;
  assert.equal(await confirm({ ...options, id: revoked.id }), false);
  assert.equal(sends, 1);
  message = { ...message, metadata: { organizationId: "company" } };
  assert.equal(await prepare(options), null);
});
