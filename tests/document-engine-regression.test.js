const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const DocumentEngine = require("../core/document/DocumentEngine");

test("DocumentEngine reads UTF-8 TXT with Polish characters", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "przemai-document-"));
  const file = path.join(directory, "raport.TXT");
  try {
    const expected = "Zażółć gęślą jaźń — płatność 123 zł";
    await fs.writeFile(file, expected, "utf8");
    assert.equal(await new DocumentEngine().extractText(file), expected);
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
});

test("DocumentEngine rejects unsupported extensions before reading a file", async () => {
  await assert.rejects(
    new DocumentEngine().extractText("/nonexistent/document.exe"),
    /Nieobsługiwany format: \.exe/
  );
});

test("DocumentEngine does not silently treat an invalid PDF as extracted text", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "przemai-pdf-"));
  const file = path.join(directory, "invalid.pdf");
  try {
    await fs.writeFile(file, "This is not a PDF", "utf8");
    await assert.rejects(new DocumentEngine().extractText(file));
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
});
