"use strict";

const { createHash, randomUUID } = require("node:crypto");
const { redactText } = require("../../lib/aiContext");

const APPROVAL = "GENERAL_TELEGRAM_APPROVAL";

async function reportFor(chat, userId, conversationId, messageId) {
  const conversation = await chat.getConversation(userId, conversationId);
  const message = conversation?.messages.find(item => item.id === messageId && item.role === "assistant");
  if (!message || message.metadata?.restricted || message.metadata?.pending || !message.content.trim()) return null;
  return { text: "# Raport PrzemAI\n\n" + redactText(message.content, 12000) + "\n", message };
}

function digest(text) { return createHash("sha256").update(text).digest("hex"); }

async function currentBinding(db, userId) {
  const binding = await db.history.findFirst({
    where: { userId, type: "TELEGRAM_LINK", report: { path: ["status"], equals: "LINKED" } },
    orderBy: { updatedAt: "desc" }
  });
  const id = binding?.report?.telegramUserId;
  if (typeof id !== "string" || !/^\d{1,16}$/.test(id)) return null;
  const current = await db.history.findFirst({
    where: { type: "TELEGRAM_LINK", report: { path: ["telegramUserId"], equals: id } },
    orderBy: { updatedAt: "desc" }
  });
  return current?.userId === userId && current?.report?.status === "LINKED" ? id : null;
}

async function prepare({ db, chat, userId, conversationId, messageId }) {
  const report = await reportFor(chat, userId, conversationId, messageId);
  if (!report || report.message.metadata?.organizationId) return null;
  const chatId = await currentBinding(db, userId);
  if (!chatId) return null;
  const id = randomUUID();
  await db.history.create({ data: { id, userId, type: APPROVAL, title: "Zgoda na wysłanie raportu",
    filename: "", report: { conversationId, messageId, digest: digest(report.text), recipient: digest(chatId),
      state: "PENDING", expires: Date.now() + 5 * 60 * 1000 } } });
  return { id };
}

async function confirm({ db, chat, userId, conversationId, id, send }) {
  const row = await db.history.findFirst({ where: { id, userId, type: APPROVAL } });
  const approval = row?.report;
  if (!approval || approval.conversationId !== conversationId || approval.state !== "PENDING" ||
      approval.expires < Date.now()) return false;
  const report = await reportFor(chat, userId, conversationId, approval.messageId);
  const chatId = await currentBinding(db, userId);
  if (!report || report.message.metadata?.organizationId || !chatId ||
      digest(report.text) !== approval.digest || digest(chatId) !== approval.recipient) return false;
  const claim = await db.history.updateMany({
    where: { id, userId, type: APPROVAL, report: { path: ["state"], equals: "PENDING" } },
    data: { report: { ...approval, state: "CONSUMED" } }
  });
  if (claim.count !== 1) return false;
  if (await currentBinding(db, userId) !== chatId) return false;
  await send({ chatId, text: report.text });
  return true;
}

module.exports = { reportFor, prepare, confirm };
