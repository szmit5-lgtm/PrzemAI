const express = require("express");
const AgentController = require("../controllers/AgentController");
const verifyToken = require("../middleware/verifyToken");

const router = express.Router();

// Live read-only Kaldeva MVP: authenticated, user-scoped, no outbound messages.
// Results are transient until the persistent worker integration is completed.
const { createKaldevSalesWorkflow } = require("../../kaldevSalesWorkflow");
const { searchPublicCompanies } = require("../../publicCompanySearch");
const kaldevaWorkflow = createKaldevSalesWorkflow({ search: searchPublicCompanies, maxLeads: 20, maxJobs: 100 });
const lastDiscovery = new Map();
router.post("/kaldeva/discover", verifyToken, async (req, res) => {
  const actorId = String(req.user?.id || "");
  if (!actorId) return res.status(401).json({ success: false, error: "Brak użytkownika." });
  const query = req.body?.query;
  if (typeof query !== "string" || query.trim().length < 5 || query.length > 200)
    return res.status(400).json({ success: false, error: "Podaj zapytanie od 5 do 200 znaków." });
  const now = Date.now();
  if (now - (lastDiscovery.get(actorId) || 0) < 60000)
    return res.status(429).json({ success: false, error: "Odczekaj minutę przed następnym wyszukiwaniem." });
  if (lastDiscovery.size > 1000) {
    for (const [key, time] of lastDiscovery) if (now - time > 120000) lastDiscovery.delete(key);
  }
  try {
    const companyId = "kaldeva:" + actorId;
    const id = kaldevaWorkflow.enqueue({ companyId, actorId, query });
    // Only successful queue admission consumes the per-user search allowance.
    lastDiscovery.set(actorId, now);
    // Return the job immediately instead of blocking the HTTP request on a
    // third-party search. The result is retrieved through GET /jobs/:id.
    setImmediate(() => {
      kaldevaWorkflow.runNext(id).catch(error => {
        console.error("kaldeva_discovery_worker_error", error?.message || "unknown");
      });
    });
    return res.status(202).json({
      success: true,
      data: { id, status: "queued", resultPath: "/api/agents/kaldeva/jobs/" + encodeURIComponent(id) }
    });
  } catch (error) {
    const full = error?.message === "sales_queue_full";
    return res.status(full ? 503 : 500).json({
      success: false,
      error: full ? "Kolejka zleceń jest pełna." : "Nie udało się przyjąć zlecenia."
    });
  }
});

// Recover jobs after navigation/reload, scoped to the authenticated user.
router.get("/kaldeva/jobs", verifyToken, (req, res) => {
  const actorId = String(req.user?.id || "");
  if (!actorId) return res.status(401).json({ success: false, error: "Brak użytkownika." });
  const data = kaldevaWorkflow.list({ companyId: "kaldeva:" + actorId, actorId }, 20);
  return res.json({ success: true, data });
});

// Only the initiating user may read a transient job; no cross-user leakage.
router.get("/kaldeva/jobs/:id", verifyToken, (req, res) => {
  const actorId = String(req.user?.id || "");
  if (!actorId) return res.status(401).json({ success: false, error: "Brak użytkownika." });
  const job = kaldevaWorkflow.get(String(req.params.id), {
    companyId: "kaldeva:" + actorId, actorId
  });
  if (!job) return res.status(404).json({ success: false, error: "Nie znaleziono zlecenia." });
  return res.json({ success: true, data: job });
});

// Allow the owner to cancel a queued search before it starts. Running jobs
// cannot be interrupted by this endpoint and return a conflict instead.
router.post("/kaldeva/jobs/:id/cancel", verifyToken, (req, res) => {
  const actorId = String(req.user?.id || "");
  if (!actorId) return res.status(401).json({ success: false, error: "Brak użytkownika." });
  const id = String(req.params.id);
  const scope = { companyId: "kaldeva:" + actorId, actorId };
  const job = kaldevaWorkflow.get(id, scope);
  if (!job) return res.status(404).json({ success: false, error: "Nie znaleziono zlecenia." });
  if (!kaldevaWorkflow.cancel(id, scope))
    return res.status(409).json({ success: false, error: "Można anulować tylko oczekujące zlecenie." });
  return res.json({ success: true, data: kaldevaWorkflow.get(id, scope) });
});

const controller = new AgentController();

router.get("/workspace/:key/assignments",verifyToken,(req,res)=>controller.assignments(req,res));
router.post("/workspace/:key/assignments",verifyToken,(req,res)=>controller.createAssignment(req,res));
router.post("/workspace/:key/assignments/:taskId/replies",verifyToken,(req,res)=>controller.replyToAssignment(req,res));
router.patch("/workspace/:key/assignments/:taskId/stage",verifyToken,(req,res)=>controller.changeAssignmentStage(req,res));

router.get(
    "/",
    verifyToken,
    (req, res) =>
        controller.list(req, res)
);

router.post(
    "/:id/run",
    verifyToken,
    (req, res) =>
        controller.runNow(req, res)
);

router.patch(
    "/:id/enabled",
    verifyToken,
    (req, res) =>
        controller.setEnabled(req, res)
);

router.get(
    "/integrations/list",
    verifyToken,
    (req, res) =>
        controller.integrations(req, res)
);

router.patch(
    "/integrations/:id/enabled",
    verifyToken,
    (req, res) =>
        controller.setIntegrationEnabled(
            req,
            res
        )
);

module.exports = router;
