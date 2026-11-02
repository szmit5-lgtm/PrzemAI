// Keep the upload UI aligned with the document and meeting formats it supports.
const DOCUMENT_EXTENSIONS = new Set(["pdf", "docx", "txt"]);
const MEETING_EXTENSIONS = new Set(["mp3", "wav", "m4a", "ogg", "webm", "mpeg", "mp4"]);
const MAX_ANALYSIS_UPLOAD_BYTES = 500 * 1024 * 1024;

export function getAnalysisUploadKind(filename) {
    const dot = typeof filename === "string" ? filename.lastIndexOf(".") : -1;
    // A bare "pdf" or hidden ".pdf" file has no real extension.
    const extension = dot > 0 && dot < filename.length - 1
        ? filename.slice(dot + 1).toLowerCase()
        : "";

    if (MEETING_EXTENSIONS.has(extension)) return "meeting";
    if (DOCUMENT_EXTENSIONS.has(extension)) return "document";

    throw new Error("Nieobsługiwany format pliku. Wybierz PDF, DOCX, TXT lub nagranie audio/wideo.");
}

// Reject invalid or oversized uploads before sending a request that cannot produce an analysis.
export function validateAnalysisUploadFile(file) {
    const kind = getAnalysisUploadKind(file?.name);
    if (!Number.isSafeInteger(file?.size) || file.size <= 0) {
        throw new Error("Plik jest pusty lub ma nieprawidłowy rozmiar.");
    }
    if (file.size > MAX_ANALYSIS_UPLOAD_BYTES) {
        throw new Error("Plik jest zbyt duży. Maksymalny rozmiar to 500 MB.");
    }
    return kind;
}
