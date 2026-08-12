const fs = require("fs");
const OpenAI = require("openai");

class SpeechToText {

    constructor() {

        this.client = new OpenAI({

            apiKey: process.env.OPENAI_API_KEY

        });

    }

    async transcribe(filePath) {

        try {

            const transcript =
                await this.client.audio.transcriptions.create({

                    file: fs.createReadStream(filePath),

                    model: "gpt-4o-mini-transcribe",

                    language: "pl"

                });

            return transcript.text;

        }

        finally {

            if (fs.existsSync(filePath)) {

                fs.unlinkSync(filePath);

            }

        }

    }

}

module.exports = SpeechToText;