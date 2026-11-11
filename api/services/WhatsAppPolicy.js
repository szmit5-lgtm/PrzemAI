"use strict";

// Fail-closed policy for WhatsApp semi-automatic mode.
// Evaluation alone never sends a message.
const BLOCKED = [
  /\b(akceptuj(?:ę|emy)?|potwierdzam(?:y)?|zgadzam(?:y)? się|podpisz(?:ę|emy)?|zawieram(?:y)?|zamawiam(?:y)?|kupuj(?:ę|emy)?)\b/i,
  /\b(zapłac(?:ę|imy)|przelej(?:ę|emy)|ureguluj(?:ę|emy)|gwarantuj(?:ę|emy)|zobowiązuj(?:ę|emy) się)\b/i,
  /\b(accept|agree|confirm the order|sign the contract|we will pay|i will pay|we commit|binding offer)\b/i
];
const SENSITIVE = /\b(umow\w*|kontrakt\w*|płatnoś\w*|faktur\w*|rabat\w*|cen\w* końcow\w*|rachun\w* bankow\w*|hasł\w*|kod\w* sms|dane poufne|contract|payment|bank account|confidential)\b/i;

function evaluateOutbound({ text, contactApproved = false, conversationEnabled = false,
  humanTakeover = false, optedOut = false, withinCustomerServiceWindow = false,
  approvedTemplate = false, globalPaused = true } = {}) {
  const content = typeof text === "string" ? text.trim() : "";
  const reasons = [];
  if (!content || content.length > 4096) reasons.push("INVALID_MESSAGE");
  if (globalPaused) reasons.push("GLOBAL_PAUSE");
  if (!contactApproved || !conversationEnabled) reasons.push("CONVERSATION_NOT_AUTHORIZED");
  if (humanTakeover) reasons.push("HUMAN_TAKEOVER");
  if (optedOut) reasons.push("CONTACT_OPTED_OUT");
  if (!withinCustomerServiceWindow && !approvedTemplate) reasons.push("WHATSAPP_WINDOW");
  if (BLOCKED.some(pattern => pattern.test(content)) || SENSITIVE.test(content)) {
    reasons.push("OWNER_APPROVAL_REQUIRED");
  }
  return { decision: reasons.length ? "NEEDS_APPROVAL_OR_BLOCKED" : "ROUTINE_ELIGIBLE",
    reasons, sendAuthorized: false };
}

module.exports = { evaluateOutbound };
