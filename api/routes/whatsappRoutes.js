"use strict";
const express = require("express");
const crypto = require("crypto");
const verifyToken = require("../middleware/verifyToken");
const { evaluateOutbound } = require("../services/WhatsAppPolicy");
const router = express.Router();

// Meta webhook verification. Fail closed when not configured.
router.get("/webhook", (req, res) => {
  const expected = process.env.WHATSAPP_VERIFY_TOKEN;
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];
  if (!expected || mode !== "subscribe" || typeof token !== "string" ||
      typeof challenge !== "string" ||
      !crypto.timingSafeEqual(Buffer.from(crypto.createHash("sha256").update(token).digest("hex")),
        Buffer.from(crypto.createHash("sha256").update(expected).digest("hex")))) {
    return res.sendStatus(403);
  }
  return res.status(200).type("text/plain").send(challenge);
});

// Signature-verified ingestion only. No auto-replies until owner-approved policy is wired.
router.post("/webhook", (req, res) => {
  const secret = process.env.WHATSAPP_APP_SECRET;
  const raw = req.rawBody;
  const header = req.get("x-hub-signature-256") || "";
  if (!secret || !Buffer.isBuffer(raw) || !/^sha256=[a-f0-9]{64}$/i.test(header)) {
    return res.sendStatus(403);
  }
  const expected = "sha256=" + crypto.createHmac("sha256", secret).update(raw).digest("hex");
  if (!crypto.timingSafeEqual(Buffer.from(header.toLowerCase()), Buffer.from(expected))) {
    return res.sendStatus(403);
  }
  if (req.body?.object !== "whatsapp_business_account") return res.sendStatus(404);
  // TODO: persist deduplicated message IDs and statuses with tenant access controls.
  // Until persistence is implemented, do not claim messages are visible in PrzemAI.
  return res.sendStatus(200);
});

router.get("/status", verifyToken, (_req, res) => res.json({
  success: true,
  mode: "SEMI_AUTOMATIC",
  phase: "WEBHOOK_RECEIVER",
  connected: false,
  sendingEnabled: false,
  webhookConfigured: Boolean(process.env.WHATSAPP_VERIFY_TOKEN && process.env.WHATSAPP_APP_SECRET),
  groupsRealtimeSupported: false
}));

router.post("/policy-preview", verifyToken, (req, res) => {
  const text = req.body?.text;
  if (typeof text !== "string" || text.length > 4096) {
    return res.status(400).json({ success: false, error: "Nieprawidłowa treść wiadomości." });
  }
  return res.json({ success: true, ...evaluateOutbound({
    text, globalPaused: true, contactApproved: false, conversationEnabled: false
  }) });
});
module.exports = router;
