const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const DocumentEngine = require("../core/document/DocumentEngine");

test("extractText reads UTF-8 TXT documents", async (t) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "przemai-document-"));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const filePath = path.join(directory, "test.txt");
  const expected = "Zażółć gęślą jaźń — dokument testowy";
  await fs.writeFile(filePath, expected, "utf8");

  const result = await new DocumentEngine().extractText(filePath);
  assert.equal(result, expected);
});

test("extractText rejects unsupported document extensions", async () => {
  await assert.rejects(
    new DocumentEngine().extractText("invalid.xlsx"),
    /Nieobsługiwany format: \.xlsx/
  );
});
