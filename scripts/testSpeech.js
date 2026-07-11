const SpeechToText = require("../core/audio/SpeechToText");

(async () => {

    const speech = new SpeechToText();

    const text = await speech.transcribe("audio/test.mp3");

    console.log();
    console.log(text);

})();