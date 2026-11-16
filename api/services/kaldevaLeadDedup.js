"use strict";

// Pure, offline lead normalization. Does not contact a CRM or send messages.
// The organization is always part of the deduplication key.
const crypto = require("node:crypto");
const STAGES = Object.freeze(["NEW", "CONTACTED", "OFFER", "NEGOTIATION", "SIGNED", "INSTALLATION", "DONE", "LOST"]);

function leadFingerprint({ organizationId, email, phone }) {
  if (typeof organizationId !== "string" || !organizationId.trim()) throw new TypeError("organizationId required");
  const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
  const normalizedPhone = typeof phone === "string" ? phone.replace(/\D/g, "") : "";
  if (!normalizedEmail && !normalizedPhone) throw new TypeError("email or phone required");
  const identifier = normalizedEmail ? "email:" + normalizedEmail : "phone:" + normalizedPhone;
  return crypto.createHash("sha256").update(JSON.stringify([organizationId, identifier])).digest("hex");
}

function leadIdentityKeys(lead) {
  if (!lead || typeof lead !== "object") throw new TypeError("lead required");
  const { organizationId, email, phone } = lead;
  if (typeof organizationId !== "string" || !organizationId.trim()) throw new TypeError("organizationId required");
  const keys = [];
  if (typeof email === "string" && email.trim()) {
    const value = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) throw new TypeError("invalid email");
    keys.push(leadFingerprint({ organizationId, email: value }));
  }
  if (typeof phone === "string" && phone.trim()) {
    if (/[A-Za-z]/.test(phone)) throw new TypeError("invalid phone");
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 7 || digits.length > 15) throw new TypeError("invalid phone");
    keys.push(leadFingerprint({ organizationId, phone: digits }));
  }
  if (!keys.length) throw new TypeError("email or phone required");
  return keys;
}

function deduplicateLeads(leads) {
  if (!Array.isArray(leads)) throw new TypeError("leads must be an array");
  const seen = new Set();
  const unique = [];
  const duplicates = [];
  for (const lead of leads) {
    const keys = leadIdentityKeys(lead);
    if (keys.some(key => seen.has(key))) duplicates.push(lead);
    else { keys.forEach(key => seen.add(key)); unique.push(lead); }
  }
  return { unique, duplicates };
}

function summarizePipeline(leads, organizationId) {
  if (!organizationId) throw new TypeError("organizationId required");
  const counts = Object.fromEntries(STAGES.map(stage => [stage, 0]));
  for (const lead of leads) {
    if (lead.organizationId !== organizationId) continue;
    if (!STAGES.includes(lead.stage)) throw new TypeError("invalid lead stage");
    counts[lead.stage]++;
  }
  return counts;
}

module.exports = { STAGES, leadFingerprint, deduplicateLeads, summarizePipeline };
