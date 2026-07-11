const fs = require("fs");
const path = require("path");

class MemoryEngine {

    constructor() {

        this.file = path.join(process.cwd(), "data", "conversations.json");

        if (!fs.existsSync(this.file)) {
            fs.writeFileSync(this.file, JSON.stringify([], null, 2));
        }

    }

    load() {

        return JSON.parse(fs.readFileSync(this.file, "utf8"));

    }

    saveConversation(user, assistant) {

        const conversations = this.load();

        conversations.push({

            date: new Date().toISOString(),

            user,

            assistant

        });

        fs.writeFileSync(this.file, JSON.stringify(conversations, null, 2));

    }

    getHistory() {

        return this.load();

    }

}

module.exports = MemoryEngine;