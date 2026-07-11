const BaseAgent = require("../../core/BaseAgent");

class MailAgent extends BaseAgent {

    constructor() {
        super("Mail");
    }

    async write(prompt) {

        const systemPrompt = `
Jesteś profesjonalnym asystentem biznesowym.

Twoim zadaniem jest pisać profesjonalne wiadomości e-mail.

Zasady:
- zachowuj uprzejmy ton,
- pisz po polsku,
- stosuj poprawną gramatykę,
- nie dodawaj zbędnych komentarzy,
- zwróć wyłącznie gotową treść wiadomości.
`;

        return await this.ai.ask(
            systemPrompt + "\n\nPolecenie:\n" + prompt
        );

    }

}

module.exports = MailAgent;