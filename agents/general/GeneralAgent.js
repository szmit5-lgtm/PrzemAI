const BaseAgent = require("../../core/BaseAgent");

class GeneralAgent extends BaseAgent {

    constructor() {
        super("General");
    }

    async process(text) {

        // Szukamy podobnych rozmów
        const history = this.memory.search(text);

        let context = "";

        if (history.length > 0) {

            context =
                "Poprzednie rozmowy:\n\n" +

                history
                    .slice(-5)
                    .map(item =>
                        `Użytkownik: ${item.user}\nAsystent: ${item.assistant}`
                    )
                    .join("\n\n");

        }

        const prompt = `
${context}

Aktualna wiadomość użytkownika:

${text}

Odpowiedz możliwie najlepiej, wykorzystując wcześniejsze informacje,
jeżeli są przydatne.
`;

        return await this.ai.ask(prompt);

    }

    async memory(query) {

        const results = this.memory.search(query);

        if (results.length === 0) {
            return "Nie znalazłem żadnych zapisanych informacji.";
        }

        let answer = `📚 Znalazłem ${results.length} wpisów.\n\n`;

        for (const item of results.slice(-10).reverse()) {

            answer +=
                `📅 ${new Date(item.date).toLocaleDateString("pl-PL")}\n` +
                `👤 ${item.user}\n\n`;

        }

        return answer;

    }

}

module.exports = GeneralAgent;