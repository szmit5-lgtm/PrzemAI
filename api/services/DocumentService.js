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
            throw new Error("Nie udało się odczytać treści dokumentu.");
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

}

module.exports = new DocumentService();