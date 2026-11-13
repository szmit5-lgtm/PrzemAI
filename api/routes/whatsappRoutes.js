"use strict";
const express = require("express");
const crypto = require("crypto");
const prisma = require("../../lib/prisma");
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

// Persist only messages from the explicitly configured Meta number and tenant.
// Fail closed on missing binding; return 503 so Meta can retry after configuration.
router.post("/webhook", async (req, res) => {
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
  const organizationId = process.env.WHATSAPP_ORGANIZATION_ID;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!organizationId || !phoneNumberId) return res.sendStatus(503);
  try {
    const org = await prisma.organization.findFirst({
      where: { id: organizationId, status: "ACTIVE" }, select: { id: true }
    });
    if (!org) return res.sendStatus(503);
    const entries = Array.isArray(req.body.entry) ? req.body.entry : [];
    for (const entry of entries.slice(0, 100)) {
      for (const change of (Array.isArray(entry.changes) ? entry.changes : []).slice(0, 100)) {
        if (change.field !== "messages") continue;
        const value = change.value || {};
        const incomingPhone = value.metadata?.phone_number_id;
        // A webhook can include unrelated phone numbers; never mix tenants.
        if (incomingPhone !== phoneNumberId) continue;
        for (const message of (Array.isArray(value.messages) ? value.messages : []).slice(0, 100)) {
          if (typeof message.id !== "string" || !/^wamid\.[\w.-]{1,250}$/.test(message.id) ||
              typeof message.from !== "string" || !/^\d{6,20}$/.test(message.from)) continue;
          const type = typeof message.type === "string" ? message.type.slice(0, 40) : "unknown";
          const body = type === "text" && typeof message.text?.body === "string"
            ? message.text.body.slice(0, 16000) : null;
          const timestamp = Number(message.timestamp);
          const receivedAt = Number.isSafeInteger(timestamp) && timestamp > 0 &&
            timestamp < 4102444800 ? new Date(timestamp * 1000) : new Date();
          try {
            await prisma.whatsAppMessage.create({
              data: { organizationId, externalMessageId: message.id,
                phoneNumberId, contactWaId: message.from, messageType: type,
                text: body, receivedAt }
            });
          } catch (error) {
            if (error?.code !== "P2002") throw error; // duplicate Meta delivery
          }
        }
      }
    }
    return res.sendStatus(200);
  } catch (error) {
    // No PII in logs. Retry on database or migration failures.
    console.error("WhatsApp webhook persistence failed:", error?.code || "UNKNOWN");
    return res.sendStatus(503);
  }
});

router.get("/status", verifyToken, (_req, res) => res.json({
  success: true,
  mode: "SEMI_AUTOMATIC",
  phase: "PERSISTENCE_CONFIGURED_WHEN_MIGRATED",
  connected: false,
  persistenceConfigured: Boolean(process.env.WHATSAPP_ORGANIZATION_ID && process.env.WHATSAPP_PHONE_NUMBER_ID),
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
