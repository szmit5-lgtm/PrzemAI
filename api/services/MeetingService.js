const DocumentEngine = require("../../core/document/DocumentEngine");
const AIEngine = require("../../core/ai/AIEngine");

class MeetingService {

    constructor() {

        this.documentEngine = new DocumentEngine();
        this.ai = new AIEngine();

    }

    async analyze(filePath) {

        const text = await this.documentEngine.extractText(filePath);

        if (!text || !text.trim()) {
            throw new Error("Nie udało się odczytać treści spotkania.");
        }

        const prompt = `
Przeanalizuj poniższą transkrypcję lub notatkę ze spotkania.

Zwróć odpowiedź WYŁĄCZNIE jako poprawny JSON.

Struktura odpowiedzi:

{
  "summary": "...",
  "keyInformation": [
    "..."
  ],
  "participants": [
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
      "owner": "...",
      "dueDate": null
    }
  ]
}

Zasady:

- nie dodawaj żadnego tekstu poza JSON,
- actionItems mają zawierać wszystkie zadania wynikające ze spotkania,
- participants mają zawierać listę uczestników,
- jeżeli nie ma danych, zwróć pustą tablicę.

Treść spotkania:

${text}
`;

        return await this.ai.ask({
            system: "Jesteś ekspertem analizującym spotkania biznesowe. Odpowiadasz wyłącznie poprawnym JSON.",
            user: prompt,
            json: true
        });

    }

}

module.exports = new MeetingService();