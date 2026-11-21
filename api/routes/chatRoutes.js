const express = require("express");

const verifyToken = require("../middleware/verifyToken");
const ChatController = require("../controllers/ChatController");
const multer = require("multer");
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