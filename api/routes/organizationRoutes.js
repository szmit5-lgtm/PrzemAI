"use strict";

const express = require("express");
const prisma = require("../../lib/prisma");
const verifyToken = require("../middleware/verifyToken");

const router = express.Router();

// Company records are created only by authenticated users. This does not
// grant access to another user's tasks, invoices, KSeF or bank connections.
router.get("/", verifyToken, async (req, res) => {
  try {
    const memberships = await prisma.organizationMembership.findMany({
      where: { userId: req.user.id, status: "ACTIVE" },
      include: { organization: { include: { domains: { select: {
        hostname: true, verifiedAt: true, isPrimary: true
      } } } } },
      orderBy: { createdAt: "asc" }
    });
    res.json({ success: true, data: memberships.map(({ role, organization }) => ({ role, ...organization })) });
  } catch {
    res.status(500).json({ success: false, error: "Nie udało się pobrać kont firmowych." });
  }
});

router.post("/", verifyToken, async (req, res) => {
  const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
  const slug = typeof req.body?.slug === "string" ? req.body.slug.trim().toLowerCase() : "";
  if (name.length < 2 || name.length > 120 ||
      !/^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])?$/.test(slug)) {
    return res.status(400).json({ success: false, error: "Podaj nazwę firmy i identyfikator (3–40 małych liter, cyfr lub łączników)." });
  }
  try {
    const organization = await prisma.organization.create({
      data: {
        name,
        slug,
        displayName: name,
        memberships: { create: { userId: req.user.id, role: "OWNER" } }
      },
      select: { id: true, name: true, slug: true, displayName: true, status: true }
    });
    res.status(201).json({ success: true, data: organization });
  } catch (error) {
    if (error?.code === "P2002") {
      return res.status(409).json({ success: false, error: "Ten identyfikator firmy jest już zajęty." });
    }
    res.status(500).json({ success: false, error: "Nie udało się utworzyć konta firmowego." });
  }
});

module.exports = router;
