"use strict";

const supportedMedia = new Set(["document", "audio", "image", "video"]);
const mimePattern = /^[a-z0-9][a-z0-9!#$&^_.+-]{0,62}\/[a-z0-9][a-z0-9!#$&^_.+-]{0,126}$/i;

function whatsAppContent(message, type) {
  if (type === "text") return {
    text: typeof message.text?.body === "string" ? message.text.body.slice(0, 16000) : null
  };
  const media = supportedMedia.has(type) && message[type];
  if (!media || typeof media !== "object" || Array.isArray(media)) return { text: null };

  const caption = typeof media.caption === "string" ? media.caption.slice(0, 4096) : null;
  const fileName = typeof media.filename === "string"
    ? media.filename.replace(/[\/\\\p{Cc}]/gu, "_").slice(0, 160)
    : null;
  const mime = typeof media.mime_type === "string" && mimePattern.test(media.mime_type)
    ? media.mime_type.toLowerCase() : null;
  return { text: caption, metadata: { attachment: {
    kind: type, ...(fileName && { fileName }), ...(mime && { mime }),
    ...(type === "audio" && { voice: media.voice === true })
  } } };
}

function publicAttachment(metadata) {
  const record = metadata?.attachment;
  if (!supportedMedia.has(record?.kind)) return null;
  return whatsAppContent({ [record.kind]: {
    filename: record.fileName, mime_type: record.mime, voice: record.voice
  } }, record.kind).metadata.attachment;
}

function draftForMessage(type) {
  const received = type === "audio" ? "nagranie" : supportedMedia.has(type) ? "załącznik" : "wiadomość";
  return "Dzień dobry, dziękujemy za " + received + ". Sprawdzimy temat i wrócimy z odpowiedzią.";
}

module.exports = { whatsAppContent, publicAttachment, draftForMessage };
