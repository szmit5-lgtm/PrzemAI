const test = require("node:test");
const assert = require("node:assert/strict");
test("meeting service starts without AI credentials and transcription fails explicitly", async () => {
    const previous = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    try {
        const SpeechToText = require("../core/speech/SpeechToText");
        const speech = new SpeechToText();
        assert.equal(speech.client, null);
        assert.ok(require("../api/services/MeetingService"));
        await assert.rejects(speech.transcribeSingleFile("unused.mp3"), /OPENAI_API_KEY is required/);
    } finally {
        if (previous === undefined) delete process.env.OPENAI_API_KEY;
        else process.env.OPENAI_API_KEY = previous;
    }
});
