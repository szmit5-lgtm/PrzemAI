const MemoryEngine = require("./MemoryEngine");

class MemoryService {

    constructor() {

        this.memory = new MemoryEngine();

    }

    saveConversation(user, assistant) {

        this.memory.saveConversation(user, assistant, {
            project: "GENERAL",
            category: "CHAT",
            source: "TELEGRAM",
            tags: ["conversation"]
        });

    }

    saveDocument(title, summary) {

        this.memory.saveDocument(title, summary, {
            project: "DOCUMENTS",
            category: "LEGAL_ANALYSIS",
            source: "TELEGRAM",
            tags: ["document"]
        });

    }

    saveMeeting(title, summary) {

        this.memory.saveMeeting(title, summary, {
            project: "MEETINGS",
            category: "SUMMARY",
            source: "TELEGRAM",
            tags: ["meeting"]
        });

    }

    saveFact(name, value) {

        this.memory.saveFact(name, value, {
            project: "KNOWLEDGE",
            category: "FACT",
            source: "AI",
            tags: ["fact"]
        });

    }

    search(query) {

        return this.memory.search(query);

    }

    latest(type, limit = 10) {

        return this.memory.latest(type, limit);

    }

}

module.exports = MemoryService;