import { test } from "node:test";
import assert from "node:assert/strict";
import { PDFDocument } from "pdf-lib";
import { createPhotoPdf } from "../src/lib/photoDocument.mjs";

const samplePhoto = Buffer.from(
  "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAMCAgICAgMCAgIDAwMDBAYEBAQEBAgGBgUGCQgKCgkICQkKDA8MCgsOCwkJDRENDg8QEBEQCgwSExIQEw8QEBD/wAALCAADAAIBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AVN//2Q==",
  "base64"
);

test("a camera image becomes a single-page document accepted by the PDF upload", async () => {
  const file = await createPhotoPdf(Uint8Array.from(samplePhoto).buffer, "zdjęcie.rachunku.jpg");
  assert.equal(file.name, "zdjęcie.rachunku.pdf");
  assert.equal(file.type, "application/pdf");
  assert.equal(await file.slice(0, 5).text(), "%PDF-");
  const doc = await PDFDocument.load(await file.arrayBuffer());
  assert.equal(doc.getPageCount(), 1);
  assert.deepEqual(doc.getPage(0).getSize(), { width: 595, height: 842 });
  await assert.rejects(createPhotoPdf(Buffer.from("not an image"), "malformed.jpg"));
});
