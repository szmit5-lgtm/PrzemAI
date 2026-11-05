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
    assert.match(source, /validateAnalysisUploadFile\(selected\)/);
    assert.match(source, /validateAnalysisUploadFile\(file\)/);
    assert.match(source, /accept=\{mode === "meeting" \?/);
    assert.match(source, /"\.mp3,\.wav,\.m4a,\.ogg,\.webm,\.mpeg,\.mp4"/);
    assert.match(source, /"\.pdf,\.docx,\.txt"/);
});

test("empty or invalid-size uploads are rejected before calling the API", async () => {
    const { validateAnalysisUploadFile } = await loadKind();
    assert.equal(validateAnalysisUploadFile({ name: "umowa.pdf", size: 1 }), "document");
    assert.equal(validateAnalysisUploadFile({ name: "spotkanie.mp3", size: 1024 }), "meeting");
    for (const size of [0, -1, NaN, Infinity, undefined, "10"]) {
        assert.throws(
            () => validateAnalysisUploadFile({ name: "umowa.pdf", size }),
            /Plik jest pusty lub ma nieprawidłowy rozmiar/
        );
    }
    assert.throws(
        () => validateAnalysisUploadFile({ name: "umowa.exe", size: 10 }),
        /Nieobsługiwany format pliku/
    );
});


test("upload size validation matches the backend 500 MB limit", async () => {
    const { validateAnalysisUploadFile } = await loadKind();
    const maxBytes = 500 * 1024 * 1024;
    assert.equal(validateAnalysisUploadFile({ name: "umowa.pdf", size: maxBytes }), "document");
    assert.equal(validateAnalysisUploadFile({ name: "spotkanie.mp3", size: maxBytes }), "meeting");
    for (const size of [maxBytes + 1, maxBytes + 1024 * 1024, Number.MAX_SAFE_INTEGER]) {
        assert.throws(
            () => validateAnalysisUploadFile({ name: "spotkanie.mp4", size }),
            /Maksymalny rozmiar to 500 MB/
        );
    }
});


test("bare extension names and hidden files are not treated as supported uploads", async () => {
    const { getAnalysisUploadKind } = await loadKind();
    for (const filename of ["pdf", "mp3", ".pdf", ".mp3", "report.", "."]) {
        assert.throws(() => getAnalysisUploadKind(filename), /Nieobsługiwany format pliku/);
    }
    assert.equal(getAnalysisUploadKind("report.PDF"), "document");
    assert.equal(getAnalysisUploadKind("recording.MP3"), "meeting");
});
