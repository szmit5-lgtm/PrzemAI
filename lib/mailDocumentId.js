"use strict";

const { createHash } = require("node:crypto");

// Stable, opaque key for one attachment in one mailbox. The attachment
// index prevents collisions when an email has two files with the same name.
function mailDocumentId({
  integrationId,
  messageId,
  uid,
  uidValidity,
  filename,
  attachmentIndex
}) {
  if (!integrationId || !Number.isInteger(attachmentIndex) ||
      attachmentIndex < 0) {
    throw new Error("Invalid mail attachment identity.");
  }

  const normalizedMessageId =
    typeof messageId === "string" ? messageId.trim() : "";
  if (!normalizedMessageId && (uid === null || uid === undefined)) {
    throw new Error("Mail message has neither Message-ID nor UID.");
  }

  const messageKey = normalizedMessageId ||
    `uid:${String(uidValidity ?? "unknown")}:${String(uid)}`;

  return createHash("sha256")
    .update(JSON.stringify([
      "MAIL", String(integrationId), messageKey,
      attachmentIndex, String(filename || "")
    ]))
    .digest("hex");
}

module.exports = mailDocumentId;
