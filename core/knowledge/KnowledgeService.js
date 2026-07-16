const MemoryService = require("../memory/MemoryService");

class KnowledgeService {

    constructor() {

        this.memory = new MemoryService();

    }

    answer(question) {

        const q = question.toLowerCase();

        // ==========================================
        // IMIĘ UŻYTKOWNIKA
        // ==========================================

        if (
            q.includes("jak mam na imię") ||
            q.includes("jak się nazywam")
        ) {

            const facts = this.memory.search("user_name");

            if (facts.length > 0) {

                const latest = facts[facts.length - 1];

                return `Masz na imię ${latest.value}.`;

            }

            return null;

        }

        // ==========================================
        // FIRMA
        // ==========================================

        if (
            q.includes("jak nazywa się moja firma") ||
            q.includes("moja firma")
        ) {

            const facts = this.memory.search("company");

            if (facts.length > 0) {

                const latest = facts[facts.length - 1];

                return `Twoja firma to ${latest.value}.`;

            }

            return null;

        }

        return null;

    }

}

module.exports = KnowledgeService;