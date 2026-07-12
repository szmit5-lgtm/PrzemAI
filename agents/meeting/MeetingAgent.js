const BaseAgent = require("../../core/BaseAgent");

class MeetingAgent extends BaseAgent {

    constructor() {

        super("Meeting");

    }

    async process(text) {

        return await this.summarize(text);

    }

    async summarize(text) {

        const prompt = `
Jesteś profesjonalnym asystentem biznesowym.

Przeanalizuj transkrypcję spotkania i przygotuj odpowiedź w następującej formie.

# 📋 Podsumowanie

(kilka zdań)

# ✅ Najważniejsze ustalenia

- ...

# 👤 Zadania

- [ ] Zadanie — Osoba odpowiedzialna

# 📅 Terminy

- ...

# ⚠ Ryzyka

- ...

# 🎯 Decyzje

- ...

Jeżeli jakiejś informacji nie ma w transkrypcji, napisz "Nie określono".

Transkrypcja:

${text}
`;

        return await this.ai.ask(prompt);

    }

}

module.exports = MeetingAgent;