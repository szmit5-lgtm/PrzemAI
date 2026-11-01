// A successful upload is only complete when the server confirms the saved report.
export function parseAnalysisUploadResponse(response, requestedFilename) {
    const report = response?.report;
    const validReport = report !== null &&
        typeof report === "object" &&
        !Array.isArray(report) &&
        Object.keys(report).length > 0;

    if (response?.success !== true ||
        typeof response.filename !== "string" ||
        !response.filename.trim() ||
        response.filename !== requestedFilename ||
        !validReport) {
        throw new Error("Brak potwierdzenia zapisanej analizy pliku.");
    }

    return { filename: response.filename, report };
}
