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
- actionItems mają zawierać wszystkie zadania wynikające z dokumentu,
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
                    content: [{ type: "input_text", text: "Jesteś ekspertem analizującym dokumenty biznesowe. Odczytaj skan PDF i odpowiedz wyłącznie poprawnym JSON." }]
                },
                {
                    role: "user",
                    content: [
                        { type: "input_text", text: 'Przeanalizuj załączony skan PDF. Zwróć JSON z polami: summary (string), keyInformation (array), dates (array), risks (array), recommendations (array), actionItems (array obiektów: title, description, priority, dueDate). Nie wymyślaj informacji niewidocznych w dokumencie.' },
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