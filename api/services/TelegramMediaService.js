"use strict";

const { extname } = require("node:path");
const { extractAttachment, MAX_FILE } = require("./ChatAttachmentService");
const DOCUMENT_TYPES = new Set([".pdf", ".docx", ".xlsx", ".jpg", ".jpeg", ".png"]);

async function downloadTelegramFile(file, { fetchRequest = fetch, token = process.env.TELEGRAM_TOKEN,
  maxBytes, pathPattern } = {}) {
  if (!token || !/^[a-zA-Z0-9_-]{1,256}$/.test(file?.file_id || "") ||
      !Number.isInteger(file.file_size) || file.file_size < 12 || file.file_size > maxBytes)
    throw new Error("Unsupported Telegram file");

  const signal = AbortSignal.timeout(8000);
  const metadata = await fetchRequest("https://api.telegram.org/bot" + token +
    "/getFile?file_id=" + encodeURIComponent(file.file_id), { signal, redirect: "error" });
  if (!metadata.ok) throw new Error("Telegram file unavailable");
  const { result } = await metadata.json();
  if (!pathPattern.test(result?.file_path || "")) throw new Error("Unsupported Telegram file path");

  const response = await fetchRequest("https://api.telegram.org/file/bot" + token + "/" + result.file_path,
    { signal, redirect: "error" });
  if (!response.ok || !response.body) throw new Error("Telegram file unavailable");
  const parts = [];
  let received = 0;
  for await (const chunk of response.body) {
    received += chunk.length;
    if (received > maxBytes || received > file.file_size) throw new Error("Telegram file too large");
    parts.push(chunk);
  }
  if (received !== file.file_size) throw new Error("Incomplete Telegram file");
  return Buffer.concat(parts);
}

async function extractTelegramDocument(document, { extractor = extractAttachment, ...options } = {}) {
  const originalname = document?.file_name;
  if (typeof originalname !== "string" || originalname.length > 160 ||
      /[\/\\\p{Cc}]/u.test(originalname) || !DOCUMENT_TYPES.has(extname(originalname).toLowerCase()))
    throw new Error("Unsupported Telegram document");

  const buffer = await downloadTelegramFile(document, {
    ...options, maxBytes: MAX_FILE, pathPattern: /^documents\/[a-zA-Z0-9_-]+\.(?:pdf|docx|xlsx|jpe?g|png)$/i
  });
  return extractor({ buffer, originalname });
}

module.exports = { downloadTelegramFile, extractTelegramDocument };
