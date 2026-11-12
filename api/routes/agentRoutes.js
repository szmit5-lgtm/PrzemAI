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
  lastDiscovery.set(actorId, now);
  if (lastDiscovery.size > 1000) {
    for (const [key, time] of lastDiscovery) if (now - time > 120000) lastDiscovery.delete(key);
  }
  try {
    const companyId = "kaldeva:" + actorId;
    const id = kaldevaWorkflow.enqueue({ companyId, actorId, query });
    const job = await kaldevaWorkflow.runNext(id);
    if (!job || job.id !== id) return res.status(503).json({ success: false, error: "Kolejka zajęta." });
    return res.status(job.status === "completed" ? 200 : 502).json({ success: job.status === "completed", data: job });
  } catch (error) {
    return res.status(502).json({ success: false, error: "Wyszukiwanie publiczne niedostępne.", detail: error.message });
  }
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
