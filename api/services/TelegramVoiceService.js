"use strict";

const { downloadTelegramFile } = require("./TelegramMediaService");
const { VoiceTranscriptionService } = require("./VoiceTranscriptionService");
const MAX_VOICE = 2 * 1024 * 1024;

async function transcribeTelegramVoice(voice, {
  fetchRequest = fetch, token = process.env.TELEGRAM_TOKEN,
  transcriber = new VoiceTranscriptionService()
} = {}) {
  if (!Number.isInteger(voice?.duration) || voice.duration < 1 || voice.duration > 60)
    throw new Error("Unsupported voice message");
  const buffer = await downloadTelegramFile(voice, {
    fetchRequest, token, maxBytes: MAX_VOICE, pathPattern: /^voice\/[a-zA-Z0-9_-]+\.oga$/
  });
  if (buffer.subarray(0, 4).toString() !== "OggS") throw new Error("Invalid Telegram voice");
  return transcriber.transcribe({ buffer, filename: "voice.ogg", contentType: "audio/ogg" });
}

module.exports = { transcribeTelegramVoice };
