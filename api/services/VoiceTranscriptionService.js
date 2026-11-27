"use strict";
const OpenAI = require("openai");
const { openAIRequestPolicy } = require("../../lib/openAIRequestPolicy");
const { toFile } = require("openai/uploads");

// Transcription is invoked only after an explicit microphone action. Audio is
// never stored in the user database or in a Railway uploads directory.
class VoiceTranscriptionService {
  constructor({ createClient = () => new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    ...openAIRequestPolicy()
  }) } = {}) {
    this.createClient = createClient;
  }
  async transcribe({ buffer, filename, contentType }) {
    if (!process.env.OPENAI_API_KEY) {
      const error = new Error("Transkrypcja mowy nie jest skonfigurowana.");
      error.status = 503;
      throw error;
    }
    const file = await toFile(buffer, filename, { type: contentType });
    const client = this.createClient();
    const response = await client.audio.transcriptions.create({
      model: "gpt-4o-mini-transcribe",
      file,
      language: "pl"
    });
    const transcript = typeof response?.text === "string" ? response.text.trim() : "";
    if (!transcript) {
      const error = new Error("Nie udało się rozpoznać wypowiedzi. Nagraj ją ponownie.");
      error.status = 422;
      throw error;
    }
    return transcript.slice(0, 5000);
  }
}
module.exports = { VoiceTranscriptionService };
