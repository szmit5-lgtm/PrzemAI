"use strict";

const { createHash } = require("node:crypto");
const { OrganizationError, OrganizationService } = require("./OrganizationService");

const NO_ACCESS = "Brak dostępu do tej spółki. Użyj /spolka, aby wybrać zakres rozmowy.";
const CHAT_ERROR = "Nie udało się teraz odpowiedzieć. Wyślij nową wiadomość, aby spróbować ponownie.";
const ROLES = ["OWNER", "ADMIN", "MEMBER"];

async function hasAccess(organizations, userId, organizationId) {
  if (!organizationId) return true;
  try {
    await organizations.membership(userId, organizationId, ROLES);
    return true;
  } catch (error) {
    if (error instanceof OrganizationError && error.status === 403) return false;
    throw error;
  }
}

async function companyCommand({ db, organizations, userId, selectionKey, argument }) {
  if (!argument) {
    const companies = (await organizations.companies(userId))
      .filter(company => ROLES.includes(company.role));
    const options = companies.map(company => `/spolka ${company.slug} — ${company.displayName || company.name}`);
    return ["Wybierz zakres rozmowy:", "/spolka - — prywatny", ...options].join("\n");
  }

  let organizationId = null;
  if (argument !== "-") {
    const company = await db.organization.findUnique({
      where: { slug: argument },
      select: { id: true }
    });
    if (!company || !await hasAccess(organizations, userId, company.id)) return NO_ACCESS;
    organizationId = company.id;
  }

  await db.telegramChatSelection.upsert({
    where: { userId_telegramUserId: selectionKey },
    create: { ...selectionKey, organizationId },
    update: { organizationId }
  });
  return organizationId ? `Wybrano spółkę: ${argument}.` : "Wybrano zakres prywatny.";
}

async function handleChat({ db, msg, text, userId, telegramUserId, isStillLinked, chat }) {
  if (!Number.isSafeInteger(msg.message_id) || msg.message_id <= 0)
    return "Nie można potwierdzić identyfikatora wiadomości.";
  if (text.length > 4096) return "Wiadomość jest zbyt długa.";

  // Claim before calling the shared backend. Replays must not write more turns
  // or start another agent plan, even if a worker stops after claiming.
  try {
    await db.telegramChatReceipt.create({
      data: { telegramUserId, messageId: String(msg.message_id), userId }
    });
  } catch (error) {
    if (error?.code === "P2002") return null;
    throw error;
  }

  const organizations = new OrganizationService({ db });
  const selectionKey = { userId, telegramUserId };
  if (/^\/spolka(?:\s|$)/.test(text)) {
    return companyCommand({ db, organizations, userId, selectionKey, argument: text.slice(7).trim() });
  }

  const getSelection = () => db.telegramChatSelection.findUnique({
    where: { userId_telegramUserId: selectionKey },
    select: { organizationId: true }
  });
  const organizationId = (await getSelection())?.organizationId ?? null;
  if (!await hasAccess(organizations, userId, organizationId)) return NO_ACCESS;

  // Each account/scope gets its own shared-backend conversation. ChatService
  // keeps this channel inaccessible from web chat, even to the same user.
  const channel = "TELEGRAM";
  const id = "telegram-" + createHash("sha256")
    .update(JSON.stringify([userId, telegramUserId, organizationId])).digest("hex");
  await db.chatConversation.createMany({
    data: { id, userId, channel, title: "Telegram" },
    skipDuplicates: true
  });

  let result;
  try {
    result = await chat(userId, text, id, { organizationId, channel });
  } catch (error) {
    console.error("[TelegramChat] Shared chat failed", error?.name || "Error");
    return CHAT_ERROR;
  }

  // Authorization can change while the model or General Agent is running.
  if (!await isStillLinked() || ((await getSelection())?.organizationId ?? null) !== organizationId)
    return null;
  if (!await hasAccess(organizations, userId, organizationId)) return NO_ACCESS;
  return result.answer?.trim() || CHAT_ERROR;
}

module.exports = { handleChat };
