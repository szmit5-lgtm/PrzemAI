const express = require("express");

const verifyToken = require("../middleware/verifyToken");
const ChatController = require("../controllers/ChatController");
const multer = require("multer");
const chat = require("../services/ChatService");
const { extractAttachment, MAX_FILE } = require("../services/ChatAttachmentService");
const reports = require("../services/ChatReportService");
const { VoiceTranscriptionService } = require("../services/VoiceTranscriptionService");
const voiceTranscription = new VoiceTranscriptionService();
const AUDIO_LIMIT = 2 * 1024 * 1024;

const voiceUpload = multer({
  storage: multer.memoryStorage(),
  limits: { files: 1, fileSize: AUDIO_LIMIT, fields: 0 },
  fileFilter: (_req, file, cb) => {
    const extension = /\.(webm|m4a|mp4|ogg|wav)$/i.exec(file.originalname || "")?.[1]?.toLowerCase();
    const mime = (file.mimetype || "").toLowerCase();
    const allowed = {
      webm: ["audio/webm", "video/webm"],
      m4a: ["audio/mp4", "audio/x-m4a"],
      mp4: ["audio/mp4", "video/mp4"],
      ogg: ["audio/ogg"],
      wav: ["audio/wav", "audio/x-wav", "audio/wave"]
    };
    if (!extension || !allowed[extension].includes(mime))
      return cb(Object.assign(new Error("Nieobsługiwany format nagrania."), { code: "VOICE_FORMAT" }));
    cb(null, true);
  }
}).single("file");

function validAudio(file) {
  const bytes = file?.buffer;
  if (!bytes || bytes.length < 12 || bytes.length > AUDIO_LIMIT) return false;
  const ext = /\.(webm|m4a|mp4|ogg|wav)$/i.exec(file.originalname || "")?.[1]?.toLowerCase();
  if (ext === "webm") return bytes.subarray(0,4).equals(Buffer.from([0x1a,0x45,0xdf,0xa3]));
  if (ext === "m4a" || ext === "mp4") return bytes.toString("ascii",4,8) === "ftyp";
  if (ext === "ogg") return bytes.toString("ascii",0,4) === "OggS";
  if (ext === "wav") return bytes.toString("ascii",0,4) === "RIFF" && bytes.toString("ascii",8,12) === "WAVE";
  return false;
}


const router = express.Router();

const controller = new ChatController();

router.get(
    "/",
    verifyToken,
    (req, res) => controller.list(req, res)
);

// Browser MediaRecorder fallback for browsers without working SpeechRecognition.
// Verify JWT first and never log or store the raw voice content.
router.post("/transcribe", verifyToken, (req, res) => voiceUpload(req, res, async uploadError => {
  if (uploadError) return res.status(400).json({
    success: false,
    error: uploadError.code === "LIMIT_FILE_SIZE" ? "Nagranie jest zbyt duże (maksymalnie 2 MB)." :
      uploadError.code === "VOICE_FORMAT" ? uploadError.message : "Nie udało się odebrać nagrania."
  });
  if (!validAudio(req.file)) return res.status(400).json({
    success: false, error: "Niepoprawny plik audio. Spróbuj nagrać wiadomość ponownie."
  });
  try {
    const extension = req.file.originalname.split(".").pop().toLowerCase();
    const text = await voiceTranscription.transcribe({
      buffer: req.file.buffer,
      filename: "voice." + extension,
      contentType: req.file.mimetype
    });
    res.set("Cache-Control", "private, no-store");
    return res.json({ success: true, transcript: text });
  } catch (error) {
    const status = [422, 503].includes(error?.status) ? error.status : 502;
    return res.status(status).json({
      success: false,
      error: status === 502 ? "Nie udało się przetworzyć nagrania. Spróbuj ponownie." : error.message
    });
  }
}));

const attachmentUpload = multer({ storage: multer.memoryStorage(),
  limits: { files: 1, fileSize: MAX_FILE, fields: 3, fieldSize: 12000 } }).single("file");

router.post("/attachment", verifyToken, (req, res) => attachmentUpload(req, res, async error => {
  if (error || !req.file) return res.status(400).json({ success: false, error: "Wybierz jeden plik do 4 MB." });
  const { organizationId, conversationId, message } = req.body;
  if ([organizationId, conversationId].some(id => id && !/^[a-zA-Z0-9_-]{1,128}$/.test(id)) ||
      (message != null && (typeof message !== "string" || message.length > 12000)))
    return res.status(400).json({ success: false, error: "Nieprawidłowe dane rozmowy." });
  let attachment;
  try { attachment = await extractAttachment(req.file); }
  catch { return res.status(422).json({ success: false, error: "Nie udało się odczytać tekstu załącznika." }); }
  try {
    const result = await chat.chat(req.user.id, message?.trim() || "Przeanalizuj załącznik: " + attachment.name,
      conversationId || null, { organizationId: organizationId || null, attachment });
    res.set("Cache-Control", "private, no-store");
    return res.json({ success: true, conversationId: result.conversationId, answer: result.answer, message: result.message });
  } catch (err) {
    return res.status(err?.status === 403 ? 403 : 502).json({ success: false, error: "Nie udało się przeanalizować załącznika." });
  }
}));

router.get("/:id/report/:messageId", verifyToken, async (req, res, next) => {
  try {
    const report = await reports.reportFor(chat, req.user.id, req.params.id, req.params.messageId);
    if (!report) return res.sendStatus(404);
    res.set("Cache-Control", "private, no-store");
    res.set("X-Content-Type-Options", "nosniff");
    return res.attachment("raport-przemai.md").type("text/plain").send(report.text);
  } catch (error) { next(error); }
});

router.post("/:id/telegram-report", verifyToken, async (req, res, next) => {
  try {
    const db = require("../../lib/prisma");
    const data = await reports.prepare({ db, chat, userId: req.user.id,
      conversationId: req.params.id, messageId: req.body?.messageId });
    if (!data) return res.status(409).json({ success: false, error: "Wymagany prywatny raport i powiązane konto Telegram." });
    return res.json({ success: true, data });
  } catch (error) { next(error); }
});

router.post("/:id/telegram-report/:approvalId", verifyToken, async (req, res, next) => {
  try {
    const sent = await reports.confirm({ db: require("../../lib/prisma"), chat, userId: req.user.id,
      conversationId: req.params.id, id: req.params.approvalId,
      send: require("../services/TelegramBridgeService").sendTelegramMessage });
    if (!sent) return res.status(409).json({ success: false, error: "Zgoda wygasła albo raport się zmienił." });
    return res.json({ success: true });
  } catch (error) { next(error); }
});

router.get(
    "/:id",
    verifyToken,
    (req, res) => controller.get(req, res)
);

router.post(
    "/",
    verifyToken,
    (req, res) => controller.chat(req, res)
);

router.delete(
    "/:id",
    verifyToken,
    (req, res) => controller.remove(req, res)
);

module.exports = router;