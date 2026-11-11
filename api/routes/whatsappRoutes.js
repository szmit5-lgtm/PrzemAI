"use strict";
const express = require("express");
const verifyToken = require("../middleware/verifyToken");
const { evaluateOutbound } = require("../services/WhatsAppPolicy");
const router = express.Router();

// Read-only rollout status: no phone number or credential exposure.
router.get("/status", verifyToken, (_req, res) => res.json({
  success: true,
  mode: "SEMI_AUTOMATIC",
  phase: "SAFE_SCAFFOLD",
  connected: false,
  sendingEnabled: false,
  coexistenceVerified: false,
  groupsRealtimeSupported: false,
  requirements: ["VERIFIED_BACKUP", "META_BSP_APPROVAL", "COEXISTENCE_ELIGIBILITY",
    "SECURE_CREDENTIALS", "WEBHOOK_VALIDATION", "OWNER_TEST_APPROVAL"]
}));

// Preview-only policy evaluation. Caller supplied flags are NOT proof of authorization.
// The endpoint never sends messages, records approvals or changes server state.
router.post("/policy-preview", verifyToken, (req, res) => {
  const text = req.body?.text;
  if (typeof text !== "string" || text.length > 4096) {
    return res.status(400).json({ success: false, error: "Nieprawidłowa treść wiadomości." });
  }
  return res.json({ success: true, ...evaluateOutbound({
    text,
    globalPaused: true,
    contactApproved: false,
    conversationEnabled: false
  }) });
});
module.exports = router;
