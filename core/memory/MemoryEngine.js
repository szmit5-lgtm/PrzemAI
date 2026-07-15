const fs = require("fs");
const path = require("path");

class MemoryEngine {

    constructor() {

        this.dataDir = path.join(process.cwd(), "data");

        if (!fs.existsSync(this.dataDir)) {
            fs.mkdirSync(this.dataDir, { recursive: true });
        }

        this.file = path.join(this.dataDir, "memory.json");

        if (!fs.existsSync(this.file)) {
            fs.writeFileSync(this.file, JSON.stringify([], null, 2));
        }

    }

    load() {

        return JSON.parse(
            fs.readFileSync(this.file, "utf8")
        );

    }

    save(entry) {

        const memory = this.load();

        memory.push({
            id: Date.now(),
            createdAt: new Date().toISOString(),
            ...entry
        });

        fs.writeFileSync(
            this.file,
            JSON.stringify(memory, null, 2)
        );

    }

    saveConversation(user, assistant, metadata = {}) {

        this.save({

            type: "conversation",

            user,

            assistant,

            project: metadata.project || "GENERAL",

            category: metadata.category || "CHAT",

            source: metadata.source || "TELEGRAM",

            tags: metadata.tags || []

        });

    }

    saveDocument(title, summary, metadata = {}) {

        this.save({

            type: "document",

            title,

            summary,

            project: metadata.project || "GENERAL",

            category: metadata.category || "DOCUMENT",

            source: metadata.source || "TELEGRAM",

            tags: metadata.tags || []

        });

    }

    saveMeeting(title, summary, metadata = {}) {

        this.save({

            type: "meeting",

            title,

            summary,

            project: metadata.project || "GENERAL",

            category: metadata.category || "MEETING",

            source: metadata.source || "TELEGRAM",

            tags: metadata.tags || []

        });

    }

    saveFact(name, value, metadata = {}) {

        this.save({

            type: "fact",

            name,

            value,

            project: metadata.project || "GENERAL",

            category: metadata.category || "FACT",

            source: metadata.source || "AI",

            tags: metadata.tags || []

        });

    }

    getHistory(limit = null) {

        const data = this.load();

        if (!limit) return data;

        return data.slice(-limit);

    }

    search(query) {

        const q = query.toLowerCase();

        return this.load().filter(item =>

            JSON.stringify(item)
                .toLowerCase()
                .includes(q)

        );

    }

    latest(type, limit = 10) {

        return this.load()

            .filter(x => x.type === type)

            .slice(-limit)

            .reverse();

    }

}

module.exports = MemoryEngine;