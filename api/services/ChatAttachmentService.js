"use strict";

const path = require("node:path");
const os = require("node:os");
const fs = require("node:fs/promises");
const { execFile } = require("node:child_process");
const { promisify } = require("node:util");
const { redactText } = require("../../lib/aiContext");
const run = promisify(execFile);
const MAX_FILE = 4 * 1024 * 1024;
const MAX_EXPANDED = 16 * 1024 * 1024;

function checkArchive(bytes) {
  return new Promise((resolve, reject) => {
    require("yauzl").fromBuffer(bytes, { lazyEntries: true }, (error, zip) => {
      if (error) return reject(error);
      let declared = 0;
      let expanded = 0;
      const fail = error => { zip.close(); reject(error); };
      zip.once("error", fail);
      zip.once("end", resolve);
      zip.on("entry", entry => {
        declared += entry.uncompressedSize;
        if (declared > MAX_EXPANDED || zip.entryCount > 500)
          return fail(new Error("Rozpakowany plik jest zbyt duży."));
        if (entry.fileName.endsWith("/")) return zip.readEntry();

        zip.openReadStream(entry, (streamError, stream) => {
          if (streamError) return fail(streamError);
          stream.on("data", chunk => {
            expanded += chunk.length;
            if (expanded > MAX_EXPANDED) stream.destroy(new Error("Rozpakowany plik jest zbyt duży."));
          });
          stream.once("error", fail);
          stream.once("end", () => zip.readEntry());
        });
      });
      zip.readEntry();
    });
  });
}

async function readImage(bytes) {
  const { type, width, height } = require("image-size").imageSize(bytes);
  if (!["png", "jpg"].includes(type) || !width || !height || width * height > 16000000)
    throw new Error("Nieobsługiwany lub zbyt duży obraz.");
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "przemai-ocr-"));
  try {
    const file = path.join(directory, "input." + type);
    await fs.writeFile(file, bytes, { mode: 0o600 });
    const { stdout } = await run("tesseract", [file, "stdout", "-l", process.env.PRZEMAI_OCR_LANGUAGE || "eng"],
      { timeout: 12000, maxBuffer: 128 * 1024 });
    return stdout;
  } finally { await fs.rm(directory, { recursive: true, force: true }); }
}

async function readScannedPdf(bytes, ocr) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "przemai-pdf-"));
  try {
    const input = path.join(directory, "input.pdf");
    const prefix = path.join(directory, "page");
    await fs.writeFile(input, bytes, { mode: 0o600 });
    await run("pdftoppm", ["-f", "1", "-l", "2", "-scale-to", "1600", "-png", input, prefix],
      { timeout: 10000, maxBuffer: 128 * 1024 });
    const pages = (await fs.readdir(directory)).filter(file => /^page-\d+\.png$/.test(file)).sort();
    const results = [];
    for (const page of pages) results.push(await ocr(await fs.readFile(path.join(directory, page))));
    return results.join("\n");
  } finally { await fs.rm(directory, { recursive: true, force: true }); }
}

async function extractAttachment(file, { ocr = readImage } = {}) {
  const bytes = file?.buffer;
  if (!Buffer.isBuffer(bytes) || !bytes.length || bytes.length > MAX_FILE) throw new Error("Nieprawidłowy plik.");
  const ext = path.extname(file.originalname || "").toLowerCase();
  let text;
  if (ext === ".pdf" && bytes.subarray(0, 5).toString() === "%PDF-") {
    try { text = (await require("pdf-parse")(bytes, { max: 12 })).text; } catch {}
    if (!text?.trim()) text = await readScannedPdf(bytes, ocr);
  } else if (ext === ".docx" || ext === ".xlsx") {
    await checkArchive(bytes);
    if (ext === ".docx") text = (await require("mammoth").extractRawText({ buffer: bytes })).value;
    else {
      const rows = await require("read-excel-file/node").readSheet(bytes);
      text = rows.slice(0, 100).map(row => row.slice(0, 20)
        .map(cell => redactText(cell, 240)).join(" | ")).join("\n");
    }
  } else if ([".png", ".jpg", ".jpeg"].includes(ext)) {
    text = await ocr(bytes);
  }
  const clean = redactText(text, 8000).trim();
  if (!clean) throw new Error("Nie znaleziono tekstu we wspieranym formacie.");
  return { name: redactText(path.basename(file.originalname), 160), text: clean };
}

module.exports = { extractAttachment, MAX_FILE };
