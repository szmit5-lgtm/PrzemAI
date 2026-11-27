"use strict";

const { createHash, randomUUID } = require("node:crypto");
const { OrganizationService } = require("./OrganizationService");

const LINK = "WHATSAPP_LINK_CODE";
const BINDING = "WHATSAPP_BINDING";
const PAIRING = /^Połącz PrzemAI ([a-f0-9-]{36})$/i;
const CHANNEL = "WHATSAPP";

function scopedId(prefix, ...parts) {
  return prefix + createHash("sha256").update(JSON.stringify(parts)).digest("hex");
}

function bindingId({ organizationId, phoneNumberId, contactWaId }) {
  return scopedId("wa-binding-", organizationId, phoneNumberId, contactWaId);
}

async function linkedUserId(db, scope) {
  const binding = await db.history.findUnique({ where: { id: bindingId(scope) } });
  return binding?.type === BINDING ? binding.userId : null;
}

async function createLink(db, userId, organizationId, phoneNumberId) {
  await new OrganizationService({ db }).membership(userId, organizationId);
  const code = randomUUID();
  const expiresAt = new Date(Date.now() + 10 * 60_000).toISOString();
  await db.history.create({ data: {
    id: scopedId("wa-code-", code), userId, type: LINK, title: "Kod powiązania WhatsApp", filename: "",
    report: { organizationId, phoneNumberId, expiresAt, status: "PENDING" }
  } });
  return { text: "Połącz PrzemAI " + code, expiresAt };
}

async function redeemLink(tx, scope, code) {
  const id = scopedId("wa-code-", code.toLowerCase());
  const link = await tx.history.findUnique({ where: { id } });
  if (!link || link.type !== LINK || link.report?.status !== "PENDING" ||
      link.report.organizationId !== scope.organizationId || link.report.phoneNumberId !== scope.phoneNumberId ||
      !(Date.parse(link.report.expiresAt) > Date.now())) return;
  try {
    await new OrganizationService({ db: tx }).membership(link.userId, scope.organizationId);
  } catch (error) {
    if (error.status === 403) return;
    throw error;
  }
  const claim = await tx.history.updateMany({
    where: { id, report: { path: ["status"], equals: "PENDING" } },
    data: { report: { status: "USED" } }
  });
  if (!claim.count) return;
  await tx.history.createMany({ data: {
    id: bindingId(scope), userId: link.userId, type: BINDING, title: "Powiązanie WhatsApp", filename: "",
    report: { linkedAt: new Date().toISOString() }
  }, skipDuplicates: true });
}

async function prepareDraft(db, scope, userId, message, sharedId = null, chat = require("./ChatService")) {
  const { organizationId, phoneNumberId, contactWaId } = scope;
  const organizations = new OrganizationService({ db });
  async function authorize() {
    await organizations.membership(userId, organizationId);
    if (message.metadata?.chatUserId !== userId || await linkedUserId(db, scope) !== userId) {
      throw Object.assign(new Error("Brak powiązania kontaktu."), { status: 403 });
    }
  }
  await authorize();
  const defaultId = scopedId("whatsapp-", userId, organizationId, phoneNumberId, contactWaId);
  if (sharedId) await chat.assertSharedWebThread(userId, sharedId, organizationId);
  const conversationId = sharedId || defaultId;
  const claim = await db.whatsAppMessage.updateMany({
    where: { id: message.id, organizationId, draftState: null }, data: { draftState: "PROCESSING" }
  });
  if (claim.count) {
    try {
      if (!sharedId) await db.chatConversation.createMany({ data: {
        id: conversationId, userId, channel: CHANNEL, title: "WhatsApp"
      }, skipDuplicates: true });
      const reply = await chat.chat(userId, message.text.slice(0, 12000), conversationId, {
        organizationId, channel: CHANNEL, requestId: scopedId("wa-", message.externalMessageId), ...(sharedId && { sharedWebThread: true })
      });
      await authorize();
      await db.whatsAppMessage.update({ where: { id: message.id }, data: {
        draftState: "READY", metadata: { ...message.metadata, chatReplyId: reply.message.id, ...(sharedId && { sharedId }) }
      } });
    } catch (error) {
      await db.whatsAppMessage.update({ where: { id: message.id }, data: { draftState: "FAILED" } });
      throw error;
    }
  }
  const source = await db.whatsAppMessage.findUnique({ where: { id: message.id } });
  if (source.draftState === "PROCESSING") throw Object.assign(new Error("Draft running"), { status: 409 });
  if (source.draftState !== "READY") throw new Error("Draft unavailable");
  const storedSharedId = source.metadata?.sharedId;
  if (sharedId && sharedId !== storedSharedId)
    throw Object.assign(new Error("Draft already belongs to another thread"), { status: 409 });
  if (storedSharedId) await chat.assertSharedWebThread(userId, storedSharedId, organizationId);
  const conversation = await chat.getConversation(userId, storedSharedId || defaultId, storedSharedId ? "WEB" : CHANNEL);
  const reply = conversation?.messages.find(row => row.id === source.metadata?.chatReplyId && row.role === "assistant");
  await authorize();
  if (!reply) throw new Error("Draft missing");
  return reply.content;
}

module.exports = { PAIRING, createLink, redeemLink, linkedUserId, prepareDraft };
