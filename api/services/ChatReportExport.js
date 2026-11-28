"use strict";

const formats = Object.freeze({
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  pdf: "application/pdf",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
});

async function makeWord(lines) {
  const { Document, Packer, Paragraph, HeadingLevel } = require("docx");
  const children = lines.map((line, index) => index === 0
    ? new Paragraph({ text: line, heading: HeadingLevel.TITLE })
    : new Paragraph({ text: line }));
  return Packer.toBuffer(new Document({ sections: [{ children }] }));
}

function makePdf(lines) {
  const PDFDocument = require("pdfkit");
  const document = new PDFDocument({ size: "A4", margin: 50, info: { Title: "Raport PrzemAI" } });
  const chunks = [];
  return new Promise((resolve, reject) => {
    document.on("data", chunk => chunks.push(chunk));
    document.once("error", reject);
    document.once("end", () => resolve(Buffer.concat(chunks)));
    document.font(require.resolve("dejavu-fonts-ttf/ttf/DejaVuSans.ttf"));
    document.fontSize(18).text(lines[0]);
    document.moveDown().fontSize(10).text(lines.slice(1).join("\n"), { lineGap: 3 });
    document.end();
  });
}

async function makeExcel(lines) {
  const writeExcelFile = require("write-excel-file/node");
  // Explicit string cells prevent formulas in model output from executing in Excel.
  const rows = lines.map(line => [{ value: line, type: String, wrap: true }]);
  return writeExcelFile(rows, { sheet: "Raport", columns: [{ width: 100 }] }).toBuffer();
}

async function exportChatReport(format, text) {
  if (!Object.hasOwn(formats, format)) return null;
  const lines = text.replace(/\r\n?/g, "\n").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\ufffe\uffff]/g, "")
    .split("\n");
  if (lines[0].startsWith("# ")) lines[0] = lines[0].slice(2);
  const write = { docx: makeWord, pdf: makePdf, xlsx: makeExcel }[format];
  return { filename: "raport-przemai." + format, contentType: formats[format], body: await write(lines) };
}

module.exports = { exportChatReport };
