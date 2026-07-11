const BaseAgent = require("../../core/BaseAgent");
const AIEngine = require("../../core/ai/AIEngine");

class MeetingAgent extends BaseAgent {

    constructor() {

        super("Meeting");

        this.ai = new AIEngine();

    }

    async summarize(text) {

        const prompt = `
Jesteś asystentem biznesowym.

Na podstawie tekstu przygotuj:

1. Krótkie podsumowanie.
2. Kluczowe ustalenia.
3. Zadania.
4. Terminy.
5. Osoby odpowiedzialne (jeżeli występują).

Tekst:

${text}
`;

        return await this.ai.ask(prompt);

    }

}

module.exports = MeetingAgent;