"use strict";
const express = require("express");
const verifyToken = require("../middleware/verifyToken");
const prisma = require("../../lib/prisma");
const { authorizePersonalMt5 } = require("../services/mt5PersonalAccess");
const { validateMt5Snapshot } = require("../services/mt5SnapshotValidation");

const router = express.Router();
router.use(verifyToken);
router.use((req, res, next) => {
  // Disabled unless explicitly configured; never infer the owner from request data.
  if (process.env.MT5_PERSONAL_READONLY_ENABLED !== "true") {
    return res.status(503).json({ success: false, error: "MT5 personal integration disabled." });
  }
  // Company context must never access private financial data.
  const companyContext = req.headers["x-organization-id"] ??
    req.headers["x-company-id"] ?? req.query.organizationId ??
    req.body?.organizationId;
  const access = authorizePersonalMt5({
    authenticatedUserId: req.user?.id,
    configuredOwnerUserId: process.env.MT5_PERSONAL_OWNER_USER_ID,
    organizationId: companyContext
  });
  if (!access.allowed) {
    return res.status(403).json({ success: false, error: "MT5 personal access denied." });
  }
  next();
});

router.get("/snapshots", async (req, res) => {
  try {
    const rows = await prisma.personalMt5Snapshot.findMany({
      where: { userId: req.user.id },
      orderBy: { capturedAt: "desc" },
      take: 50
    });
    return res.json({ success: true, snapshots: rows });
  } catch (_) {
    return res.status(500).json({ success: false, error: "MT5 history unavailable." });
  }
});

router.post("/snapshots", async (req, res) => {
  // Separate explicit switch for accepting live financial data from Windows.
  if (process.env.MT5_PERSONAL_INGEST_ENABLED !== "true") {
    return res.status(503).json({ success: false, error: "MT5 ingestion disabled." });
  }
  const parsed = validateMt5Snapshot(req.body);
  if (!parsed.ok) {
    return res.status(400).json({ success: false, error: "Invalid MT5 snapshot." });
  }
  const s = parsed.snapshot;
  const capturedAt = new Date(s.asOf);
  const now = Date.now();
  if (capturedAt.getTime() > now + 5 * 60_000 || capturedAt.getTime() < now - 24 * 60 * 60_000) {
    return res.status(400).json({ success: false, error: "MT5 snapshot timestamp out of range." });
  }
  try {
    const record = await prisma.personalMt5Snapshot.upsert({
      where: { userId_capturedAt: { userId: req.user.id, capturedAt } },
      update: {},
      create: {
        userId: req.user.id, capturedAt, currency: s.currency,
        balance: s.balance, equity: s.equity,
        positionCount: s.positionCount, positions: s.positions
      }
    });
    return res.status(201).json({ success: true, id: record.id });
  } catch (_) {
    return res.status(500).json({ success: false, error: "MT5 snapshot not saved." });
  }
});
module.exports = router;
