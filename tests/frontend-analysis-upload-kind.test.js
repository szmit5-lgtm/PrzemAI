"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");

async function loadKind() {
    const source = await fs.readFile(
        path.join(__dirname, "../frontend/src/lib/analysisUploadKind.js"), "utf8"
    );
    return import("data:text/javascript;base64," + Buffer.from(source).toString("base64"));
}

test("supported documents are routed to document analysis", async () => {
    const { getAnalysisUploadKind } = await loadKind();
    for (const filename of ["umowa.pdf", "oferta.DOCX", "notatka.txt"]) {
        assert.equal(getAnalysisUploadKind(filename), "document");
    }
});

test("supported recordings are routed to meeting analysis", async () => {
    const { getAnalysisUploadKind } = await loadKind();
    for (const extension of ["mp3", "wav", "m4a", "ogg", "webm", "mpeg", "mp4"]) {
        assert.equal(getAnalysisUploadKind("spotkanie." + extension), "meeting");
    }
});

test("unsupported, missing and misleading extensions are rejected", async () => {
    const { getAnalysisUploadKind } = await loadKind();
    for (const filename of ["", "umowa", "umowa.exe", "umowa.pdf.exe", ".pdfx", null, undefined]) {
        assert.throws(() => getAnalysisUploadKind(filename), /Nieobsługiwany format pliku/);
    }
});

test("upload UI validates selection and routes via the same helper", async () => {
    const source = await fs.readFile(
        path.join(__dirname, "../frontend/src/app/components/FileUpload.js"), "utf8"
    );
    assert.match(source, /getAnalysisUploadKind\(selected\.name\)/);
    assert.match(source, /getAnalysisUploadKind\(file\.name\)/);
    assert.match(source, /accept="\.pdf,\.docx,\.txt,\.mp3,\.wav,\.m4a,\.ogg,\.webm,\.mpeg,\.mp4"/);
});
