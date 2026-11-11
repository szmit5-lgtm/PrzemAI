"use strict";

const { createHash } = require("node:crypto");
const { Prisma } = require("@prisma/client");
const { authorizeKsefReadOnly } = require("./KsefReadOnlyFlow");
const KsefClient = require("./KsefClient");
const { importKsefMetadata } = require("./importKsefMetadata");
const { analyzeKsefXml } = require("./analyzeKsefXml");
const { ensureDekonicaProjects } = require("./ensureDekonicaProjects");
const { getKsefHistoryCursor } = require("../../lib/ksefHistoryCursor");

// Backfill historic windows in bounded batches; persist progress after each
// complete bidirectional window, so interrupted runs resume safely.
const DEFAULT_HISTORY_START = "2026-02-01T00:00:00.000Z";
const WINDOW_DAYS = 60;
const XML_BATCH = 10;
const XML_GAP_MS = 5000;
const MAX_HISTORY_WINDOWS = 6;
const MAX_XML_BATCH = 12;

function positiveInt(value, fallback, max) {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 1 || number > max) return fallback;
  return number;
}

function xmlRetryDelay(attempts, error) {
  // Back off failing documents so they do not monopolize every import run.
  if (/HTTP 40[134]/.test(String(error?.message || ""))) return 24 * 3600 * 1000;
  return Math.min(12 * 3600 * 1000, Math.max(5, 5 * 2 ** Math.min(attempts, 7)) * 60000);
}

function nextHistoryWindow(cursor, recentStart) {
  const start = new Date(cursor);
  const cutoff = new Date(recentStart);
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(cutoff.getTime()) ||
      start.getTime() < Date.parse(DEFAULT_HISTORY_START) ||
      start >= cutoff) return null;
  const end = new Date(Math.min(start.getTime() + WINDOW_DAYS * 86400000, cutoff.getTime()));
  return { from: start.toISOString(), to: end.toISOString() };
}

async function syncKsefOwner({
  userId, prisma, token, nip, company = "dekonica", environment = "production",
  now = new Date(), authorize = authorizeKsefReadOnly, Client = KsefClient,
  historyWindowsPerRun = positiveInt(process.env.KSEF_BACKFILL_WINDOWS_PER_RUN, 1, MAX_HISTORY_WINDOWS),
  xmlBatchSize = positiveInt(process.env.KSEF_XML_BATCH_SIZE, XML_BATCH, MAX_XML_BATCH)
} = {}) {
  if (typeof userId !== "string" || !userId.trim() || userId !== userId.trim() ||
      !prisma?.financialDocument || !prisma?.agent) {
    throw new Error("Invalid owner KSeF sync configuration.");
  }
  if (!/^[0-9]{10}$/.test(String(nip || "")) || !["dekonica", "deherus"].includes(company)) {
    throw new Error("Invalid KSeF company scope.");
  }
  // Every XML request and project analysis must remain within this company NIP.
  const documentScope = { userId, source: "KSEF", OR: [{ buyerNip: nip }, { sellerNip: nip }] };
  const cursorKey = company === "deherus" ? "ksefDeherusBackfillCursor" : "ksefBackfillCursor";
  const nowMs = new Date(now).getTime();
  if (!Number.isFinite(nowMs)) throw new Error("Invalid KSeF sync time.");
  const recentStart = new Date(nowMs - 86400000).toISOString();

  const accessToken = await authorize({ token, nip, environment });
  const client = new Client({ environment, accessToken });
  let created = 0;
  let duplicates = 0;
  let xmlFetched = 0;
  let xmlFailed = 0;
  const xmlFailureCodes = {};
  function classifyXmlFailure(error) {
    const message = String(error?.message || "");
    const status = /KSeF invoice XML HTTP ([0-9]{3})/.exec(message);
    if (status) return "HTTP_" + status[1];
    if (/identifier/.test(message)) return "INVALID_IDENTIFIER";
    if (/Invalid or oversized/.test(message)) return "INVALID_XML";
    if (/network|stream/.test(message)) return "NETWORK";
    return "OTHER";
  }
  let historicWindow = null;
  let historicalWindows = 0;
  let historyComplete = false;

  async function syncRange(from, to) {
    for (const [subjectType, direction] of [["Subject2", "INCOMING"], ["Subject1", "OUTGOING"]]) {
      for await (const invoices of client.iterateInvoiceMetadata({
        subjectType, dateType: "PermanentStorage", from, to, pageSize: 100, maxPages: 40
      })) {
        const result = await importKsefMetadata({ userId, invoices, prisma, direction });
        created += result.created;
        duplicates += result.duplicates;
      }
    }
  }

  await syncRange(recentStart, new Date(nowMs).toISOString());

  // Existing agents retain other config fields and already-completed cursor.
  const agent = await prisma.agent.findUnique({
    where: { userId_key: { userId, key: "financial" } },
    select: { config: true }
  });
  const config = agent?.config && !Array.isArray(agent.config) &&
    typeof agent.config === "object" ? agent.config : {};
  let cursor = getKsefHistoryCursor(config, company);
  for (let i = 0; agent && i < historyWindowsPerRun; i += 1) {
    const historical = nextHistoryWindow(cursor, recentStart);
    if (!historical) break;
    await syncRange(historical.from, historical.to);
    // The checkpoint is committed ONLY after both buyer/seller directions
    // have finished successfully, never while a partial window is in flight.
    await prisma.agent.update({
      where: { userId_key: { userId, key: "financial" } },
      data: { config: { ...config, [cursorKey]: historical.to } }
    });
    cursor = historical.to;
    historicWindow = historical;
    historicalWindows += 1;
  }
  historyComplete = !nextHistoryWindow(cursor, recentStart);

  // Analyze existing XML as well as newly downloaded invoices, within owner scope.
  if (company === "dekonica") await ensureDekonicaProjects({ prisma, userId });
  const projects = typeof prisma.project?.findMany === "function"
    ? await prisma.project.findMany({
        where: { userId, status: "ACTIVE" },
        select: { id: true, name: true, aliases: true, status: true, company: true },
        take: 300
      }) : [];
  // This pilot's KSeF credentials represent Dekonica only; never match
  // projects explicitly labeled as another business.
  const permittedProjects = projects.filter(project =>
    typeof project.company === "string" && (company === "dekonica" ? /dekonica/i.test(project.company) : /(?:deherus|\bm1\b)/i.test(project.company)));
  const projectCatalogSignature = createHash("sha256").update(JSON.stringify(permittedProjects)).digest("hex").slice(0,16);
  // Query the *missing* XML records instead of only the newest 150 invoices.
  // A durable retry timestamp prevents a few unauthorized or invalid XMLs
  // from endlessly blocking later invoices.
  const missing = await prisma.financialDocument.findMany({
    where: { ...documentScope, rawData: { equals: Prisma.DbNull } },
    select: { id: true, ksefNumber: true, rawData: true, metadata: true, projectId: true, dueDate: true },
    orderBy: [{ issueDate: "asc" }, { id: "asc" }],
    take: 3000
  });

  const fetchedDocuments = [];
  let attempted = 0;
  for (const item of missing) {
    if (attempted >= xmlBatchSize) break;
    if (!item.ksefNumber) continue;
    const state = item.metadata?.ksefXmlRetry;
    if (state?.nextRetryAt && Date.parse(state.nextRetryAt) > nowMs) continue;
    // KSeF production invoice-download quota: 8/s, 16/min, 64/hour.
    // A conservative 5-second gap and 10 downloads per run leave room
    // for metadata, manual runs and official quota adjustments.
    if (attempted > 0 && Client === KsefClient) {
      await new Promise(resolve => setTimeout(resolve, XML_GAP_MS));
    }
    attempted += 1;
    try {
      const xml = await client.getInvoiceXml(item.ksefNumber);
      await prisma.financialDocument.updateMany({
        where: { id: item.id, ...documentScope },
        data: { rawData: {
          xml, origin: "KSEF_OFFICIAL_XML", downloadedAt: new Date().toISOString()
        } }
      });
      fetchedDocuments.push({ ...item, rawData: { xml } });
      xmlFetched += 1;
    } catch (error) {
      xmlFailed += 1;
      const code = classifyXmlFailure(error);
      xmlFailureCodes[code] = (xmlFailureCodes[code] || 0) + 1;
      // Save only bounded retry diagnostics; never log XML, invoice identifiers
      // or upstream response bodies, which can contain sensitive data.
      const attempts = Math.min(100, (Number(state?.attempts) || 0) + 1);
      const metadata = item.metadata && typeof item.metadata === "object" &&
        !Array.isArray(item.metadata) ? item.metadata : {};
      await prisma.financialDocument.updateMany({
        where: { id: item.id, userId, source: "KSEF" },
        data: { metadata: { ...metadata, ksefXmlRetry: {
          attempts, nextRetryAt: new Date(nowMs + xmlRetryDelay(attempts, error)).toISOString()
        } } }
      });
      // Respect throttling: never hammer KSeF after the first 429.
      if (code === "HTTP_429") break;
    }
  }

  // Revisit EVERY imported XML across stable pages, not only the newest 1000.
  // Reclassification also runs for old invoices when Dekonica project aliases change.
  let projectAssigned = 0;
  let projectDescribed = 0;
  let projectReview = 0;
  let projectErrors = 0;
  const processed = new Set();

  async function classify(item) {
    if (!item?.id || processed.has(item.id)) return;
    processed.add(item.id);
    const xml = item.rawData?.xml;
    if (typeof xml !== "string" || !xml) return;
    const previous = item.metadata?.analysis;
    if (previous?.projectDecision === "MANUAL") return;
    if (previous?.version === 3 &&
        previous.projectCatalogSignature === projectCatalogSignature) return;
    try {
      const analysis = analyzeKsefXml(xml, permittedProjects);
      const metadata = item.metadata && typeof item.metadata === "object" &&
        !Array.isArray(item.metadata) ? item.metadata : {};
      const shouldAssign = !item.projectId && Boolean(analysis.projectId);
      const next = {
        metadata: { ...metadata, analysis: {
          version: 3, projectCatalogSignature,
          title: analysis.title, description: analysis.description,
          itemCount: analysis.itemCount, itemPreview: analysis.itemPreview,
          projectDecision: item.projectId ? (previous?.projectDecision || "EXISTING") : analysis.projectDecision,
          projectHint: item.projectId ? (previous?.projectHint || null) : analysis.projectHint,
          projectEvidence: item.projectId ? (previous?.projectEvidence || null) : analysis.projectEvidence,
          analyzedAt: new Date().toISOString()
        } }
      };
      if (shouldAssign) next.projectId = analysis.projectId;
      if (!item.dueDate && analysis.dueDate) next.dueDate = analysis.dueDate;
      const updated = await prisma.financialDocument.updateMany({
        where: { id: item.id, ...documentScope, projectId: item.projectId || null },
        data: next
      });
      if (updated?.count === 1) {
        projectDescribed += 1;
        if (shouldAssign) projectAssigned += 1;
        else if (!item.projectId) projectReview += 1;
      }
    } catch {
      projectErrors += 1;
    }
  }
  for (const item of fetchedDocuments) await classify(item);
  let scanCursor = null;
  for (let page = 0; page < 75; page += 1) {
    const existing = await prisma.financialDocument.findMany({
      where: { ...documentScope, rawData: { not: Prisma.DbNull } },
      select: { id: true, rawData: true, metadata: true, projectId: true, dueDate: true },
      orderBy: { id: "asc" },
      ...(scanCursor ? { cursor: { id: scanCursor }, skip: 1 } : {}),
      take: 40
    });
    if (!existing.length) break;
    for (const item of existing) await classify(item);
    scanCursor = existing[existing.length - 1].id;
    if (existing.length < 40) break;
  }
  return { created, duplicates, xmlFetched, xmlFailed, historicWindow, historicalWindows, historyComplete,
    projectAssigned, projectDescribed, projectReview, projectErrors, xmlFailureCodes };
}

module.exports = { syncKsefOwner, nextHistoryWindow };
