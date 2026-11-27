"use strict";

const { VoiceTranscriptionService } = require("./VoiceTranscriptionService");
const MAX_VOICE = 2 * 1024 * 1024;

async function transcribeTelegramVoice(voice, {
  fetchRequest = fetch, token = process.env.TELEGRAM_TOKEN,
  transcriber = new VoiceTranscriptionService()
} = {}) {
  if (!token || !/^[a-zA-Z0-9_-]{1,256}$/.test(voice?.file_id || "") ||
      !Number.isInteger(voice.duration) || voice.duration < 1 || voice.duration > 60 ||
      !Number.isInteger(voice.file_size) || voice.file_size < 12 || voice.file_size > MAX_VOICE)
    throw new Error("Unsupported voice message");
  const signal = AbortSignal.timeout(8000);
  const metadata = await fetchRequest("https://api.telegram.org/bot" + token +
    "/getFile?file_id=" + encodeURIComponent(voice.file_id), { signal, redirect: "error" });
  if (!metadata.ok) throw new Error("Telegram file unavailable");
  const { result } = await metadata.json();
  if (!/^voice\/[a-zA-Z0-9_-]+\.oga$/.test(result?.file_path || ""))
    throw new Error("Unsupported Telegram file path");
  const response = await fetchRequest("https://api.telegram.org/file/bot" + token + "/" + result.file_path,
    { signal, redirect: "error" });
  if (!response.ok || !response.body) throw new Error("Telegram voice unavailable");
  let received = 0;
  const parts = [];
  for await (const chunk of response.body) {
    received += chunk.length;
    if (received > MAX_VOICE) throw new Error("Voice too large");
    parts.push(chunk);
  }
  const buffer = Buffer.concat(parts);
  if (buffer.subarray(0, 4).toString() !== "OggS") throw new Error("Invalid Telegram voice");
  return transcriber.transcribe({ buffer, filename: "voice.ogg", contentType: "audio/ogg" });
}

module.exports = { transcribeTelegramVoice };
