require("dotenv").config();

const OpenAI = require("openai");

class AIEngine {

    constructor() {

        this.client = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY
        });

    }

    async ask(options) {

        if (typeof options === "string") {

            options = {
                user: options
            };

        }

        const {

            system =
                "Jesteś PrzemAI - Executive Business Assistant.",

            user = "",

            model = "gpt-5.5",

            json = false

        } = options;

        const response = await this.client.responses.create({

            model,

            text: json
                ? {
                    format: {
                        type: "json_object"
                    }
                }
                : undefined,

            input: [

                {
                    role: "system",
                    content: [
                        {
                            type: "input_text",
                            text: system
                        }
                    ]
                },

                {
                    role: "user",
                    content: [
                        {
                            type: "input_text",
                            text: user
                        }
                    ]
                }

            ]

        });

        const output = response.output_text;

        if (!json) {

            return output;

        }

        try {

            return JSON.parse(output);

        }
        catch {

            throw new Error(
                "AI zwróciło niepoprawny JSON."
            );

        }

    }

    async extractMemories(options) {

        const {

            userMessage = "",
            assistantMessage = ""

        } = options || {};

        if (
            !userMessage.trim() &&
            !assistantMessage.trim()
        ) {

            return [];

        }

        const prompt = `
Przeanalizuj poniższą rozmowę użytkownika z asystentem.

Twoim zadaniem jest wykrycie informacji,
które warto zapisać w długoterminowej pamięci użytkownika.

Zapisuj tylko informacje, które mogą być przydatne
w przyszłych rozmowach.

Przykładowe typy pamięci:

- PERSON
- COMPANY
- CLIENT
- PROJECT
- DECISION
- PREFERENCE
- FACT
- AGREEMENT
- DEADLINE
- BUSINESS
- OTHER

Nie zapisuj:

- zwykłych pytań,
- chwilowych poleceń,
- powitań,
- informacji technicznych dotyczących samego działania czatu,
- informacji, które nie mają przyszłej wartości,
- przypuszczeń,
- informacji wymyślonych przez asystenta.

Najważniejsze zasady:

1. Zapisuj wyłącznie fakty wynikające z rozmowy.
2. Nie wymyślaj brakujących informacji.
3. Jedna pamięć powinna zawierać jeden konkretny fakt lub ustalenie.
4. importance ma być liczbą od 1 do 5.
5. Jeśli nic nie warto zapamiętać, zwróć pustą tablicę memories.
6. title powinien być krótki i czytelny.
7. content powinien zawierać pełną informację.
8. tags powinny być krótkimi słowami lub nazwami.
9. source ustaw zawsze na "CHAT".

Zwróć WYŁĄCZNIE poprawny JSON w formacie:

{
  "memories": [
    {
      "type": "CLIENT",
      "title": "Klient ABC",
      "content": "Klient ABC korzysta z Microsoft 365.",
      "source": "CHAT",
      "importance": 4,
      "tags": [
        "ABC",
        "Microsoft 365"
      ]
    }
  ]
}

WIADOMOŚĆ UŻYTKOWNIKA:

${userMessage}

ODPOWIEDŹ ASYSTENTA:

${assistantMessage}
`;

        const result = await this.ask({

            system:
                "Jesteś modułem Memory Extraction systemu PrzemAI. Wykrywasz wyłącznie fakty warte zapisania w pamięci długoterminowej. Nie zmyślasz informacji.",

            user: prompt,

            json: true

        });

        if (!Array.isArray(result?.memories)) {

            return [];

        }

        return result.memories
            .filter(memory =>
                memory &&
                typeof memory.title === "string" &&
                memory.title.trim() &&
                typeof memory.content === "string" &&
                memory.content.trim()
            )
            .map(memory => ({

                type:
                    typeof memory.type === "string" &&
                    memory.type.trim()
                        ? memory.type
                            .trim()
                            .toUpperCase()
                        : "OTHER",

                title:
                    memory.title
                        .trim()
                        .slice(0, 200),

                content:
                    memory.content
                        .trim(),

                source: "CHAT",

                importance: this.normalizeImportance(
                    memory.importance
                ),

                tags: Array.isArray(memory.tags)
                    ? memory.tags
                        .filter(tag =>
                            typeof tag === "string" &&
                            tag.trim()
                        )
                        .map(tag =>
                            tag.trim().slice(0, 100)
                        )
                        .slice(0, 20)
                    : []

            }));

    }

    normalizeImportance(value) {

        const importance = Number(value);

        if (!Number.isFinite(importance)) {

            return 3;

        }

        return Math.min(
            5,
            Math.max(
                1,
                Math.round(importance)
            )
        );

    }

}

module.exports = AIEngine;