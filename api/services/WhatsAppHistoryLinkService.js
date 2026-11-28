"use strict";

const { createHash, randomBytes } = require("node:crypto");

const LINK = "WHATSAPP_WEB_LINK";
const CHALLENGE = "WHATSAPP_WEB_CHALLENGE";
const PREFIX = "PRZEMAI-LINK";
const contactPattern = /^\d{6,20}$/;
const conversationPattern = /^[a-zA-Z0-9_-]{1,128}$/;
const digest = value => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const hasMembership = (db, userId, organizationId) => db.organizationMembership.findFirst({
  where: { userId, organizationId, status: "ACTIVE", organization: { status: "ACTIVE" } },
  select: { id: true }
});
const hasThread = (db, userId, organizationId, id) => db.chatConversation.findFirst({
  where: { id, userId, channel: "WEB", archivedAt: null,
    messages: { some: { metadata: { path: ["organizationId"], equals: organizationId } } } },
  select: { id: true }
});
const bindingId = (organizationId, phoneNumberId, contact) =>
  "wa-link-" + digest([organizationId, phoneNumberId, contact]);

async function issue({ db, userId, organizationId, phoneNumberId, conversationId, contact, now = Date.now() }) {
  if (!userId || !organizationId || !phoneNumberId ||
      typeof contact !== "string" || !contactPattern.test(contact) ||
      typeof conversationId !== "string" || !conversationPattern.test(conversationId)) return null;
  if (!await hasMembership(db, userId, organizationId) ||
      !await hasThread(db, userId, organizationId, conversationId)) return null;
  const code = randomBytes(24).toString("hex");
  const expires = now + 5 * 60 * 1000;
  await db.history.create({ data: {
    id: "wa-code-" + digest(code), userId, type: CHALLENGE, title: "Powiązanie WhatsApp", filename: "",
    report: { organizationId, phoneNumberId, contact, conversationId, expires, state: "PENDING" }
  } });
  return { message: PREFIX + " " + code, expiresAt: new Date(expires).toISOString() };
}

async function mirror({ db, organizationId, phoneNumberId, contact, messageId, text, receivedAt, now = Date.now() }) {
  if (typeof text !== "string") return false;
  if (text.trim().toUpperCase().startsWith(PREFIX)) {
    const code = /^PRZEMAI-LINK ([0-9a-f]{48})$/.exec(text.trim())?.[1];
    // Never persist pairing codes in a tenant inbox, even on a replay or invalid challenge.
    if (!code) return true;
    await db.$transaction(async tx => {
      const id = "wa-code-" + digest(code);
      const challenge = await tx.history.findFirst({ where: { id, type: CHALLENGE } });
      const link = challenge?.report;
      if (!link || link.state !== "PENDING" || link.expires <= now || link.organizationId !== organizationId ||
          link.phoneNumberId !== phoneNumberId || link.contact !== contact ||
          !await hasMembership(tx, challenge.userId, organizationId) ||
          !await hasThread(tx, challenge.userId, organizationId, link.conversationId)) return;
      const claim = await tx.history.updateMany({
        where: { id, userId: challenge.userId, type: CHALLENGE, report: { path: ["state"], equals: "PENDING" } },
        data: { report: { ...link, state: "CONSUMED" } }
      });
      if (claim.count !== 1) return;
      const target = bindingId(organizationId, phoneNumberId, contact);
      // One sender in a tenant has one owner. Another account cannot take over
      // even by racing two valid challenges for the same sender.
      const row = { organizationId, phoneNumberId, contact, conversationId: link.conversationId };
      await tx.history.createMany({ data: {
        id: target, userId: challenge.userId, type: LINK, title: "Historia WhatsApp", filename: "", report: row
      }, skipDuplicates: true });
      await tx.history.updateMany({ where: { id: target, userId: challenge.userId, type: LINK }, data: { report: row } });
    });
    return true;
  }

  return db.$transaction(async tx => {
    const turnId = "wa-turn-" + digest([organizationId, phoneNumberId, messageId]);
    if (await tx.chatMessage.findUnique({ where: { id: turnId }, select: { id: true } })) return true;
    if (await tx.whatsAppMessage.findUnique({ where: { externalMessageId: messageId }, select: { id: true } })) return true;
    const binding = await tx.history.findFirst({ where: { id: bindingId(organizationId, phoneNumberId, contact), type: LINK } });
    const link = binding?.report;
    if (!link) return false;
    if (link.organizationId !== organizationId || link.phoneNumberId !== phoneNumberId ||
        link.contact !== contact || !await hasMembership(tx, binding.userId, organizationId) ||
        !await hasThread(tx, binding.userId, organizationId, link.conversationId)) return true;
    const inserted = await tx.chatMessage.createMany({
      data: { id: turnId,
        conversationId: link.conversationId, role: "user", content: text.slice(0, 12000),
        metadata: { organizationId, origin: "WHATSAPP" }, createdAt: receivedAt },
      skipDuplicates: true
    });
    if (inserted.count === 1) await tx.chatConversation.updateMany({
      where: { id: link.conversationId, userId: binding.userId, archivedAt: null, lastMessageAt: { lt: receivedAt } },
      data: { lastMessageAt: receivedAt }
    });
    return true;
  }, { isolationLevel: "Serializable" });
}

async function status({ db, userId, organizationId, phoneNumberId, conversationId, contact }) {
  if (!userId || typeof contact !== "string" || !contactPattern.test(contact) ||
      typeof conversationId !== "string" || !conversationPattern.test(conversationId) ||
      !await hasMembership(db, userId, organizationId) ||
      !await hasThread(db, userId, organizationId, conversationId)) return { linked: false };
  const row = await db.history.findFirst({
    where: { id: bindingId(organizationId, phoneNumberId, contact), userId, type: LINK },
    select: { report: true }
  });
  return { linked: row?.report?.conversationId === conversationId };
}

async function unlink({ db, userId, organizationId, phoneNumberId, contact }) {
  if (!userId || typeof contact !== "string" || !contactPattern.test(contact)) return;
  await db.history.deleteMany({ where: {
    userId, OR: [
      { id: bindingId(organizationId, phoneNumberId, contact), type: LINK },
      { type: CHALLENGE, AND: [
        { report: { path: ["organizationId"], equals: organizationId } },
        { report: { path: ["phoneNumberId"], equals: phoneNumberId } },
        { report: { path: ["contact"], equals: contact } }
      ] }
    ]
  } });
}

module.exports = { issue, mirror, status, unlink, isPairingText: text => typeof text === "string" && text.trim().toUpperCase().startsWith(PREFIX) };
