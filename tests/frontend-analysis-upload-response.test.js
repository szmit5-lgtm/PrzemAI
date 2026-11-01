"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");

async function loadParser() {
    const source = await fs.readFile(
        path.join(__dirname, "../frontend/src/lib/analysisUploadPayload.js"), "utf8"
    );
    return import("data:text/javascript;base64," + Buffer.from(source).toString("base64"));
}

test("document and meeting uploads accept confirmed, nonempty reports", async () => {
    const { parseAnalysisUploadResponse } = await loadParser();
    const document = { success: true, filename: "umowa.pdf", report: { summary: "Podsumowanie" } };
    const meeting = { success: true, filename: "spotkanie.mp3", report: { actionItems: [] } };
    assert.deepEqual(parseAnalysisUploadResponse(document, "umowa.pdf"), {
        filename: "umowa.pdf", report: document.report
    });
    assert.deepEqual(parseAnalysisUploadResponse(meeting, "spotkanie.mp3"), {
        filename: "spotkanie.mp3", report: meeting.report
    });
});

test("upload rejects missing or unconfirmed acknowledgements", async () => {
    const { parseAnalysisUploadResponse } = await loadParser();
    const valid = { success: true, filename: "umowa.pdf", report: { summary: "OK" } };
    for (const response of [
        null, {}, { ...valid, success: false }, { ...valid, success: "true" },
        { ...valid, success: undefined }, { ...valid, filename: "" },
        { ...valid, filename: "inny.pdf" }
    ]) {
        assert.throws(
            () => parseAnalysisUploadResponse(response, "umowa.pdf"),
            /Brak potwierdzenia zapisanej analizy pliku/
        );
    }
});

test("upload rejects empty or malformed report content", async () => {
    const { parseAnalysisUploadResponse } = await loadParser();
    const valid = { success: true, filename: "umowa.pdf", report: { summary: "OK" } };
    for (const report of [null, undefined, "", "Podsumowanie", [], {}, 0, true]) {
        assert.throws(
            () => parseAnalysisUploadResponse({ ...valid, report }, "umowa.pdf"),
            /Brak potwierdzenia zapisanej analizy pliku/
        );
    }
});

test("upload UI validates the response before displaying the report", async () => {
    const source = await fs.readFile(
        path.join(__dirname, "../frontend/src/app/components/FileUpload.js"), "utf8"
    );
    assert.match(source, /parseAnalysisUploadResponse\(data, file\.name\)/);
    assert.match(source, /setFilename\(analysis\.filename\)/);
    assert.match(source, /setReport\(analysis\.report\)/);
    assert.doesNotMatch(source, /setReport\(data\.report\)/);
});
