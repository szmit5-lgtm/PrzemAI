"use strict";
const express = require("express");
const multer = require("multer");
const crypto = require("node:crypto");
const path = require("node:path");
const prisma = require("../../lib/prisma");
const { OrganizationService, OrganizationError } = require("../services/OrganizationService");

const { OrganizationInvestmentService } = require("../services/OrganizationInvestmentService");
const investments = new OrganizationInvestmentService();

const router = express.Router({ mergeParams: true });
const organizations = new OrganizationService();
const MAX_FILE_SIZE = 8 * 1024 * 1024;
const MAX_ORG_BYTES = 200 * 1024 * 1024;
const MAX_ORG_FILES = 120;
const ALLOWED = {
  ".pdf": "application/pdf",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".txt": "text/plain"
};

// Access is enforced at the backend, not inferred from a client-side company selector.
// Only ACTIVE OWNER/ADMIN members can access this initial private document library.
router.get("/investment/:investmentId/:documentId/download", async (req, res) => {
  try {
    await investments.requireInvestment(req.user.id, req.params.id, req.params.investmentId);
    return download(req, res);
  } catch (error) {
    return res.status(error instanceof OrganizationError ? error.status : 500).json({
      success: false, error: "Nie można pobrać dokumentu inwestycji."
    });
  }
});

router.use(async (req, res, next) => {
  try {
    await organizations.membership(req.user?.id, req.params.id, ["OWNER", "ADMIN"]);
    next();
  } catch (error) {
    res.status(error instanceof OrganizationError ? error.status : 500).json({
      success: false, error: error instanceof OrganizationError ? error.message : "Nie udało się potwierdzić uprawnień."
    });
  }
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { files: 1, fileSize: MAX_FILE_SIZE },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase();
    if (!ALLOWED[ext]) return cb(Object.assign(new Error("Obsługujemy wyłącznie PDF, DOCX i TXT."), { code: "INVALID_DOCUMENT" }));
    cb(null, true);
  }
}).single("file");

function validFile(file) {
  if (!file?.buffer?.length || file.size > MAX_FILE_SIZE) return false;
  const ext = path.extname(file.originalname || "").toLowerCase();
  if (ext === ".pdf") return file.buffer.subarray(0, 5).toString("ascii") === "%PDF-";
  if (ext === ".docx") return file.buffer.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04]));
  if (ext === ".txt") {
    try {
      new TextDecoder("utf-8", { fatal: true }).decode(file.buffer);
      return !file.buffer.includes(0);
    } catch { return false; }
  }
  return false;
}
function fileName(name) {
  const clean = String(name || "").replace(/[\\/\x00-\x1f\x7f]/g, "_").trim();
  if (!clean || clean.length > 255) return null;
  return clean;
}
const fileMeta = { id: true, name: true, contentType: true, size: true, createdAt: true, uploadedById: true, investmentId: true, isInvestmentReport: true };

router.get("/", async (req, res) => {
  try {
    const items = await prisma.organizationDocument.findMany({
      where: { organizationId: req.params.id },
      select: fileMeta,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: MAX_ORG_FILES
    });
    return res.json({ success: true, items });
  } catch {
    return res.status(500).json({ success: false, error: "Nie udało się pobrać dokumentów firmowych." });
  }
});

router.post("/", (req, res) => upload(req, res, async uploadError => {
  if (uploadError) {
    return res.status(400).json({
      success: false,
      error: uploadError.code === "LIMIT_FILE_SIZE" ? "Dokument może mieć maksymalnie 8 MB." :
        uploadError.code === "INVALID_DOCUMENT" ? uploadError.message : "Nie udało się wczytać dokumentu."
    });
  }
  const name = fileName(req.file?.originalname);
  if (!name || !validFile(req.file)) return res.status(400).json({
    success: false, error: "Nieprawidłowy plik. Wybierz poprawny dokument PDF, DOCX lub TXT (do 8 MB)."
  });
  const sha256 = crypto.createHash("sha256").update(req.file.buffer).digest("hex");
  const ext = path.extname(name).toLowerCase();
  try {
    let investmentId = null;
    if (req.query?.investmentId !== undefined) {
      const { investment } = await investments.requireInvestment(req.user.id, req.params.id, req.query.investmentId);
      investmentId = investment.id;
    }
    const isInvestmentReport = Boolean(investmentId && req.query.report === "true");
    // Budget protection: bounded durable storage, without an external bucket fee.
    const [stats, existing] = await Promise.all([
      prisma.organizationDocument.aggregate({ where: { organizationId: req.params.id }, _count: { _all: true }, _sum: { size: true } }),
      prisma.organizationDocument.findFirst({
        where: { organizationId: req.params.id, sha256 },
        select: { id: true }
      })
    ]);
    if (existing) return res.status(409).json({ success: false, error: "Ten dokument jest już w bibliotece tej firmy." });
    if (stats._count._all >= MAX_ORG_FILES || (stats._sum.size || 0) + req.file.size > MAX_ORG_BYTES) {
      return res.status(413).json({ success: false, error: "Biblioteka firmy osiągnęła limit plików lub miejsca. Skontaktuj się z administratorem." });
    }
    const document = await prisma.organizationDocument.create({
      data: {
        organizationId: req.params.id,
        uploadedById: req.user.id,
        name, contentType: ALLOWED[ext], size: req.file.size, sha256,
        content: req.file.buffer, investmentId, isInvestmentReport
      },
      select: fileMeta
    });
    return res.status(201).json({ success: true, item: document });
  } catch (error) {
    if (error instanceof OrganizationError) return res.status(error.status).json({ success: false, error: error.message });
    if (error?.code === "P2002") return res.status(409).json({ success: false, error: "Ten dokument jest już w bibliotece tej firmy." });
    return res.status(500).json({ success: false, error: "Nie udało się zapisać dokumentu firmowego." });
  }
}));

async function download(req, res) {
  try {
    const item = await prisma.organizationDocument.findFirst({
      where: {
        id: req.params.documentId, organizationId: req.params.id,
        ...(req.params.investmentId ? { investmentId: req.params.investmentId } : {})
      },
      select: { name: true, content: true, size: true }
    });
    if (!item) return res.status(404).json({ success: false, error: "Nie znaleziono dokumentu w tej firmie." });
    const fallback = "document" + (path.extname(item.name).toLowerCase() || ".bin");
    res.set({
      "Content-Type": "application/octet-stream",
      "Content-Disposition": 'attachment; filename="' + fallback + '"; filename*=UTF-8\'\'' + encodeURIComponent(item.name),
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store"
    });
    return res.send(Buffer.from(item.content));
  } catch {
    return res.status(500).json({ success: false, error: "Nie udało się pobrać dokumentu firmowego." });
  }
}

router.get("/:documentId/download", download);

module.exports = router;
