// Keep the upload UI aligned with the document and meeting formats it supports.
const DOCUMENT_EXTENSIONS = new Set(["pdf", "docx", "txt"]);
const MEETING_EXTENSIONS = new Set(["mp3", "wav", "m4a", "ogg", "webm", "mpeg", "mp4"]);

export function getAnalysisUploadKind(filename) {
    const extension = typeof filename === "string"
        ? filename.split(".").pop().toLowerCase()
        : "";

    if (MEETING_EXTENSIONS.has(extension)) return "meeting";
    if (DOCUMENT_EXTENSIONS.has(extension)) return "document";

    throw new Error("Nieobsługiwany format pliku. Wybierz PDF, DOCX, TXT lub nagranie audio/wideo.");
}
