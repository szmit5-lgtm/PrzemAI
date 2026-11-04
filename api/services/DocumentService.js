const fs = require("node:fs/promises");
const path = require("node:path");
const DocumentEngine = require("../../core/document/DocumentEngine");
const AIEngine = require("../../core/ai/AIEngine");

class DocumentService {

    constructor() {

        this.documentEngine = new DocumentEngine();
        this.ai = new AIEngine();

    }

    async analyze(filePath) {

        const text = await this.documentEngine.extractText(filePath);

        if (!text || !text.trim()) {
            if (path.extname(filePath).toLowerCase() === ".pdf") {
                return this.analyzeScannedPDF(filePath);
            }
            throw new Error("Nie znaleziono tekstu w dokumencie.");
        }

        const prompt = `
Przeanalizuj poniższy dokument.

Zwróć odpowiedź WYŁĄCZNIE jako poprawny JSON.

Struktura odpowiedzi:

{
  "summary": "...",
  "keyInformation": [
    "..."
  ],
  "dates": [
    "..."
  ],
  "risks": [
    "..."
  ],
  "recommendations": [
    "..."
  ],
  "actionItems": [
    {
      "title": "...",
      "description": "...",
      "priority": "LOW | MEDIUM | HIGH",
      "dueDate": null
    }
  ]
}

Zasady:

- nie dodawaj żadnego tekstu poza JSON,
- pisz wyłącznie po polsku, jasno i profesjonalnie, dla osoby zarządzającej firmą,
- summary: maksymalnie 3 krótkie zdania, zaczynając od celu dokumentu i najważniejszego wniosku,
- keyInformation: maksymalnie 5 najważniejszych faktów, bez pobocznych szczegółów,
- dates: tylko terminy i daty istotne operacyjnie; pomijaj daty ustaw, cytowanych aktów prawnych i ogólne okresy retencji,
- risks: maksymalnie 3 konkretne ryzyka wynikające z treści dokumentu; nie wymyślaj ryzyk,
- recommendations: maksymalnie 3 konkretne zalecenia bez powtarzania zadań,
- actionItems: maksymalnie 5 konkretnych, niepowtarzających się zadań; łącz podobne czynności i pomijaj rutynowe obowiązki niezwiązane z decyzją użytkownika,
- priority pozostaje LOW, MEDIUM lub HIGH dla zgodności z API; dueDate ustaw tylko gdy dokument zawiera rzeczywisty termin,
- nie powielaj informacji RODO, chyba że wpływają na istotną decyzję lub obowiązek,
- jeżeli nie da się ustalić, czy dokument podpisano, nie twierdź, że jest niepodpisany,
- jeżeli dokument nie zawiera zadań, zwróć pustą tablicę.

Dokument:

${text}
`;

return await this.ai.ask({
    system: "Jesteś ekspertem analizującym dokumenty biznesowe. Odpowiadasz wyłącznie poprawnym JSON.",
    user: prompt,
    json: true
});

    }

    async analyzeScannedPDF(filePath) {
        const file = await fs.readFile(filePath);
        // Avoid sending very large scans as inline API payloads.
        if (file.length > 20 * 1024 * 1024) {
            throw new Error("Skan PDF przekracza 20 MB. Zmniejsz plik przed analizą OCR.");
        }
        const response = await this.ai.client.responses.create({
            model: "gpt-5.5",
            text: { format: { type: "json_object" } },
            input: [
                {
                    role: "system",
                    content: [{ type: "input_text", text: "Jesteś ekspertem analizującym dokumenty biznesowe. Odczytaj skan PDF i odpowiedz wyłącznie poprawnym JSON po polsku. Podsumowanie maksymalnie 3 zdania; do 5 kluczowych informacji, 3 istotnych ryzyk, 3 zaleceń i 5 niepowtarzających się zadań. Pomijaj poboczne informacje RODO i daty aktów prawnych. Nie wymyślaj faktów ani terminów." }]
                },
                {
                    role: "user",
                    content: [
                        { type: "input_text", text: 'Przeanalizuj załączony skan PDF. Zwróć JSON z polami: summary (string), keyInformation (array), dates (array), risks (array), recommendations (array), actionItems (array obiektów: title, description, priority, dueDate). Zwięźle i profesjonalnie po polsku: summary do 3 zdań, keyInformation do 5 punktów, dates tylko istotne terminy operacyjne, risks do 3, recommendations do 3, actionItems do 5 konkretnych i niepowtarzających się zadań. Nie wymyślaj informacji niewidocznych w dokumencie.' },
                        { type: "input_file", filename: "document.pdf", file_data: "data:application/pdf;base64," + file.toString("base64") }
                    ]
                }
            ]
        });
        try {
            return JSON.parse(response.output_text);
        } catch {
            throw new Error("Nie udało się przeanalizować skanu PDF.");
        }
    }
}

module.exports = new DocumentService();