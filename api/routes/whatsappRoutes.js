"use strict";
const express = require("express");
const crypto = require("crypto");
const prisma = require("../../lib/prisma");
const verifyToken = require("../middleware/verifyToken");
const { evaluateOutbound } = require("../services/WhatsAppPolicy");
const { OrganizationService } = require("../services/OrganizationService");
const { PAIRING, createLink, redeemLink, linkedUserId, prepareDraft } = require("../services/WhatsAppChatService");
const router = express.Router();

// Private conversations and generated drafts must never be cached by browsers,
// shared proxies or CDNs, including on authorization failures.
router.use((req, res, next) => {
  res.set("Cache-Control", "private, no-store, max-age=0");
  res.set("Pragma", "no-cache");
  res.set("Vary", "Authorization");
  next();
});

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
  if (!organizationId || !phoneNumberId) {
    console.error("[WhatsApp] WEBHOOK_BINDING_MISSING");
    return res.sendStatus(503);
  }
  try {
    const org = await prisma.organization.findFirst({
      where: { id: organizationId, status: "ACTIVE" }, select: { id: true }
    });
    if (!org) {
      console.error("[WhatsApp] WEBHOOK_ORGANIZATION_INACTIVE_OR_MISSING");
      return res.sendStatus(503);
    }
    const entries = req.body.entry;
    if (!Array.isArray(entries) || entries.length > 100) return res.sendStatus(400);
    const deliveries = [];
    for (const entry of entries) {
      if (!Array.isArray(entry?.changes) || entry.changes.length > 100) return res.sendStatus(400);
      for (const change of entry.changes) {
        if (change?.field !== "messages" || change.value?.metadata?.phone_number_id !== phoneNumberId) continue;
        const { messages, statuses } = change.value;
        if (messages === undefined && Array.isArray(statuses)) continue;
        if (!Array.isArray(messages) || deliveries.length + messages.length > 100) return res.sendStatus(400);
        for (const message of messages) {
          if (typeof message?.id !== "string" || !/^wamid\.[\w.+/=\-]{1,250}$/.test(message.id) ||
              typeof message.from !== "string" || !/^\d{6,20}$/.test(message.from)) return res.sendStatus(400);
          const messageType = typeof message.type === "string" ? message.type.slice(0, 40) : "unknown";
          const body = messageType === "text" && typeof message.text?.body === "string"
            ? message.text.body.slice(0, 16000) : null;
          const pairing = PAIRING.exec(body?.trim() || "");
          const timestamp = Number(message.timestamp);
          const receivedAt = Number.isSafeInteger(timestamp) && timestamp > 0 &&
            timestamp < 4102444800 ? new Date(timestamp * 1000) : new Date();
          deliveries.push({
            code: pairing?.[1],
            data: { organizationId, phoneNumberId, contactWaId: message.from,
              externalMessageId: message.id, messageType: pairing ? "pairing" : messageType,
              text: pairing ? null : body, receivedAt }
          });
        }
      }
    }
    if (deliveries.length) {
      await prisma.$transaction(async tx => {
        for (const { code, data } of deliveries) {
          if (data.messageType === "text" && data.text) {
            const chatUserId = await linkedUserId(tx, data);
            if (chatUserId) data.metadata = { chatUserId };
          }
          const inserted = await tx.whatsAppMessage.createMany({ data, skipDuplicates: true });
          if (inserted.count && code) await redeemLink(tx, data, code);
        }
      });
    }
    return res.sendStatus(200);
  } catch (error) {
    // No PII in logs. Retry on database or migration failures.
    console.error("WhatsApp webhook persistence failed:", error?.code || "UNKNOWN");
    return res.sendStatus(503);
  }
});

// Tenant-scoped inbox. Never use the browser-selected company as authorization.
router.get("/organizations/:organizationId/messages", verifyToken, async (req, res) => {
  const organizationId = req.params.organizationId;
  try {
    const membership = await prisma.organizationMembership.findFirst({
      where: { organizationId, userId: req.user.id, status: "ACTIVE",
        organization: { status: "ACTIVE" } },
      select: { id: true }
    });
    if (!membership) return res.sendStatus(403);
    const contactWaId = typeof req.query.contact === "string" ? req.query.contact : null;
    if (contactWaId && !/^\d{6,20}$/.test(contactWaId))
      return res.status(400).json({ success: false, error: "Nieprawidłowy kontakt." });
    const take = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 50));
    const data = await prisma.whatsAppMessage.findMany({
      where: { organizationId, ...(contactWaId ? { contactWaId } : {}) },
      orderBy: [{ receivedAt: "desc" }, { id: "desc" }], take,
      select: { id: true, contactWaId: true, direction: true, messageType: true,
        text: true, receivedAt: true }
    });
    return res.json({ success: true, data });
  } catch (error) {
    console.error("WhatsApp inbox read failed:", error?.code || "UNKNOWN");
    return res.status(503).json({ success: false, error: "Skrzynka chwilowo niedostępna." });
  }
});

// Read-only conversation summaries for a tenant-scoped inbox.
// No outbound API is exposed; drafts are generated locally for human review.
router.get("/organizations/:organizationId/conversations", verifyToken, async (req, res) => {
  const organizationId = req.params.organizationId;
  try {
    const membership = await prisma.organizationMembership.findFirst({
      where: { organizationId, userId: req.user.id, status: "ACTIVE",
        organization: { status: "ACTIVE" } }, select: { id: true }
    });
    if (!membership) return res.sendStatus(403);
    const contacts = await prisma.whatsAppMessage.groupBy({
      by: ["contactWaId"], where: { organizationId },
      _max: { receivedAt: true }, _count: { _all: true },
      orderBy: { _max: { receivedAt: "desc" } }, take: 50
    });
    return res.json({ success: true, data: contacts.map(item => ({
      contactWaId: item.contactWaId,
      lastMessageAt: item._max.receivedAt,
      messageCount: item._count._all
    })) });
  } catch (error) {
    console.error("WhatsApp conversations failed:", error?.code || "UNKNOWN");
    return res.status(503).json({ success: false, error: "Rozmowy chwilowo niedostępne." });
  }
});

router.post("/organizations/:organizationId/link-code", verifyToken, async (req, res) => {
  const { organizationId } = req.params;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!phoneNumberId || organizationId !== process.env.WHATSAPP_ORGANIZATION_ID)
    return res.sendStatus(403);
  try {
    return res.status(201).json({ success: true, data: await createLink(prisma, req.user.id, organizationId, phoneNumberId) });
  } catch (error) {
    if (error.status === 403) return res.sendStatus(403);
    console.error("[WhatsApp] Link creation failed", error?.code || "UNKNOWN");
    return res.sendStatus(503);
  }
});

router.post("/organizations/:organizationId/draft-preview", verifyToken, async (req, res) => {
  const { organizationId } = req.params;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const contactWaId = req.body?.contactWaId;
  if (typeof contactWaId !== "string" || !/^\d{6,20}$/.test(contactWaId))
    return res.status(400).json({ success: false, error: "Nieprawidłowy kontakt." });
  if (!phoneNumberId || organizationId !== process.env.WHATSAPP_ORGANIZATION_ID)
    return res.sendStatus(403);
  try {
    await new OrganizationService({ db: prisma }).membership(req.user.id, organizationId);
    const scope = { organizationId, phoneNumberId, contactWaId };
    const last = await prisma.whatsAppMessage.findFirst({
      where: { ...scope, direction: "INBOUND", messageType: "text", text: { not: null } },
      orderBy: [{ receivedAt: "desc" }, { id: "desc" }]
    });
    if (!last?.text?.trim()) return res.sendStatus(404);
    const draft = await prepareDraft(prisma, scope, req.user.id, last);
    return res.json({ success: true, contactWaId, sourceMessageId: last.id,
      draft, requiresHumanApproval: true, sent: false,
      policy: evaluateOutbound({ text: draft, globalPaused: true }) });
  } catch (error) {
    if (error.status === 403 || error.status === 409) return res.sendStatus(error.status);
    console.error("WhatsApp draft preview failed:", error?.code || "UNKNOWN");
    return res.status(503).json({ success: false, error: "Podgląd szkicu niedostępny." });
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
