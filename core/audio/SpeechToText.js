require("dotenv").config();

const fs = require("fs");
const OpenAI = require("openai");

class SpeechToText {

    constructor() {

        this.client = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY
        });

    }

    async transcribe(filePath) {

        const transcription = await this.client.audio.transcriptions.create({

            file: fs.createReadStream(filePath),

            model: "gpt-4o-mini-transcribe"

        });

        return transcription.text;

    }

}

module.exports = SpeechToText;