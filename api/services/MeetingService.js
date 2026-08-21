const SpeechToText = require("../../core/speech/SpeechToText");
const AIEngine = require("../../core/ai/AIEngine");

class MeetingService {

    constructor() {

        this.speechToText =
            new SpeechToText();

        this.ai =
            new AIEngine();

    }

    async analyze(filePath) {

        const text =
            await this.speechToText.transcribe(filePath);

        if (!text || !text.trim()) {

            throw new Error(
                "Nie udało się utworzyć transkrypcji spotkania."
            );

        }

        const prompt = `
Przeanalizuj poniższą transkrypcję spotkania biznesowego.

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
- przygotuj krótkie executive summary,
- wyciągnij wszystkie najważniejsze ustalenia,
- participants mają zawierać uczestników tylko wtedy,
  gdy można ich ustalić z transkrypcji,
- actionItems mają zawierać wszystkie zadania
  wynikające ze spotkania,
- owner podawaj tylko wtedy, gdy można go ustalić,
- nie wymyślaj osób, terminów ani ustaleń,
- jeśli nie ma danych dla danej sekcji,
  zwróć pustą tablicę.

Transkrypcja spotkania:

${text}
`;

        return await this.ai.ask({

            system:
                "Jesteś ekspertem analizującym spotkania biznesowe. " +
                "Tworzysz executive summary, ustalenia i zadania. " +
                "Odpowiadasz wyłącznie poprawnym JSON.",

            user: prompt,

            json: true

        });

    }

}

module.exports = new MeetingService();