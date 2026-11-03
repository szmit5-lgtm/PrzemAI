const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const DocumentService = require("../api/services/DocumentService");

test("blank uploaded document is rejected before calling AI", async (t) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "przemai-empty-document-"));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const filePath = path.join(directory, "empty.txt");
  await fs.writeFile(filePath, "  \n\t  ", "utf8");

  const originalAI = DocumentService.ai;
  let aiCalled = false;
  DocumentService.ai = {
    ask: async () => {
      aiCalled = true;
      throw new Error("AI must not be called for empty documents");
    }
  };
  t.after(() => { DocumentService.ai = originalAI; });

  await assert.rejects(
    DocumentService.analyze(filePath),
    /Nie znaleziono tekstu w dokumencie.*OCR/
  );
  assert.equal(aiCalled, false);
});
