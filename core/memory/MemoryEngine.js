const fs = require("fs");
const path = require("path");

class MemoryEngine {

    constructor() {

        this.dataDir = path.join(process.cwd(), "data");

        if (!fs.existsSync(this.dataDir)) {
            fs.mkdirSync(this.dataDir, { recursive: true });
        }

        this.file = path.join(this.dataDir, "conversations.json");

        if (!fs.existsSync(this.file)) {
            fs.writeFileSync(this.file, JSON.stringify([], null, 2));
        }

    }

    load() {

        return JSON.parse(
            fs.readFileSync(this.file, "utf8")
        );

    }

    saveConversation(user, assistant, metadata = {}) {

        const conversations = this.load();

        conversations.push({

            id: Date.now(),

            date: new Date().toISOString(),

            user,

            assistant,

            project: metadata.project || "GENERAL",

            category: metadata.category || "CHAT",

            source: metadata.source || "TELEGRAM",

            tags: metadata.tags || []

        });

        fs.writeFileSync(
            this.file,
            JSON.stringify(conversations, null, 2)
        );

    }

    getHistory(limit = null) {

        const data = this.load();

        if (!limit) return data;

        return data.slice(-limit);

    }

    search(query) {

        const q = query.toLowerCase();

        return this.load().filter(item => {

            return (
                (item.user || "").toLowerCase().includes(q) ||
                (item.assistant || "").toLowerCase().includes(q) ||
                (item.project || "").toLowerCase().includes(q) ||
                (item.category || "").toLowerCase().includes(q) ||
                (item.tags || []).join(" ").toLowerCase().includes(q)
            );

        });

    }

}

module.exports = MemoryEngine;