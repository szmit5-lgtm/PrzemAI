const express = require("express");
const AgentController = require("../controllers/AgentController");
const verifyToken = require("../middleware/verifyToken");

const router = express.Router();
const {AgentMonitoringService}=require("../services/AgentMonitoringService");
const monitor=new AgentMonitoringService();
router.get("/monitor",verifyToken,async(req,res)=>{
 try{
  return res.json({success:true,data:await monitor.report(req.user.id)});
 }catch(error){
  const status=error?.status===401?401:500;
  return res.status(status).json({success:false,
   error:status===401?"Zaloguj się do PrzemAI.":"Nie udało się odczytać stanu agentów."});
 }
});
const prisma = require("../../lib/prisma");
const KALDEVA_HISTORY_TYPE = "KALDEVA_SALES";
const MAIL_ALERT_TYPE="DEKONICA_MAIL_ALERT";
const {OperationalStatusService}=require("../services/OperationalStatusService");
const operations=new OperationalStatusService();
router.get("/mail/status",verifyToken,async(req,res)=>{
 try{return res.json({success:true,data:await operations.mail(req.user.id)});}
 catch(error){const status=error?.status===403?403:500;
  return res.status(status).json({success:false,error:status===403?error.message:"Nie udało się ustalić statusu poczty."});}
});
// Saved alerts belong to exactly one authenticated user. No endpoint sends,
// drafts or forwards messages to the shared mailbox.
router.get("/mail/alerts",verifyToken,async(req,res)=>{
 try{
  const alerts=await prisma.history.findMany({
   where:{userId:req.user.id,type:MAIL_ALERT_TYPE},
   orderBy:{createdAt:"desc"},take:100,
   select:{id:true,createdAt:true,report:true}
  });
  return res.json({success:true,data:{items:alerts.map(a=>({
   id:a.id,createdAt:a.createdAt,...a.report
  }))}});
 }catch{
  return res.status(500).json({success:false,error:"Nie można odczytać alertów poczty."});
 }
});
router.patch("/mail/alerts/:alertId/review",verifyToken,async(req,res)=>{
 try{
  const found=await prisma.history.findFirst({
   where:{id:req.params.alertId,userId:req.user.id,type:MAIL_ALERT_TYPE},
   select:{id:true,report:true}
  });
  if(!found)return res.status(404).json({success:false,error:"Nie znaleziono alertu."});
  const report={...found.report,status:"REVIEWED",reviewedAt:new Date().toISOString()};
  const written=await prisma.history.updateMany({
   where:{id:found.id,userId:req.user.id,type:MAIL_ALERT_TYPE},
   data:{report}
  });
  if(written.count!==1)return res.status(409).json({success:false,error:"Nie można oznaczyć alertu."});
  return res.json({success:true,data:{id:found.id,status:"REVIEWED"}});
 }catch{
  return res.status(500).json({success:false,error:"Nie można zapisać przeglądu alertu."});
 }
});


// Live read-only Kaldeva MVP: authenticated, user-scoped, no outbound messages.
// PostgreSQL History is the sole queue state; the worker owns execution.
const { randomUUID } = require("node:crypto");
const { evaluateSalesAction } = require("../../salesAgentPolicy");
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
    const decision = evaluateSalesAction({ type: "search_web", companyId }, { companyId, actorId });
    if (decision.decision !== "allow") return res.status(403).json({ success: false, error: "Brak uprawnienia do wyszukiwania." });
    const id = randomUUID();
    // Persist the queued job before returning 202 so it survives navigation.
    // If persistence is unavailable, do not claim that a durable job was accepted.
    const queued = { id, companyId, actorId, query: query.trim(), status: "queued", report: null, error: null };
    try {
      await prisma.history.create({ data: {
        id, userId: actorId, type: KALDEVA_HISTORY_TYPE,
        title: "Kaldeva: " + query.slice(0, 150), filename: "",
        report: queued
      } });
    } catch (persistenceError) {
      console.error("kaldeva_queue_persistence_error", persistenceError?.message || "unknown");
      return res.status(503).json({ success: false, error: "Nie można zapisać zlecenia. Spróbuj ponownie." });
    }
    lastDiscovery.set(actorId, now);
    return res.status(202).json({
      success: true,
      data: { id, status: "queued", resultPath: "/api/agents/kaldeva/jobs/" + encodeURIComponent(id) }
    });
  } catch (error) {
    console.error("kaldeva_enqueue_error", error?.message || "unknown");
    return res.status(500).json({ success: false, error: "Nie udało się przyjąć zlecenia." });
  }
});

// Read durable jobs after navigation/reload, scoped to the authenticated user.
router.get("/kaldeva/jobs", verifyToken, async (req, res) => {
  const actorId = String(req.user?.id || "");
  if (!actorId) return res.status(401).json({ success: false, error: "Brak użytkownika." });
  try {
    const saved = await prisma.history.findMany({
      where: { userId: actorId, type: KALDEVA_HISTORY_TYPE },
      orderBy: { createdAt: "desc" }, take: 20,
      select: { report: true }
    });
    return res.json({ success: true, data: saved.map(item => item.report) });
  } catch {
    return res.status(500).json({ success: false, error: "Nie udało się pobrać historii zleceń." });
  }
});

// Only the initiating user may read the persisted job; no cross-user leakage.
router.get("/kaldeva/jobs/:id", verifyToken, async (req, res) => {
  const actorId = String(req.user?.id || "");
  if (!actorId) return res.status(401).json({ success: false, error: "Brak użytkownika." });
  // Persisted worker result takes precedence over the transient API queue.
  try {
    const saved = await prisma.history.findFirst({
      where: { id: String(req.params.id), userId: actorId, type: KALDEVA_HISTORY_TYPE },
      select: { report: true }
    });
    if (!saved) return res.status(404).json({ success: false, error: "Nie znaleziono zlecenia." });
    return res.json({ success: true, data: saved.report });
  } catch {
    return res.status(500).json({ success: false, error: "Nie udało się pobrać zlecenia." });
  }
});

// Allow the owner to cancel a queued search before it starts. Running jobs
// cannot be interrupted by this endpoint and return a conflict instead.
router.post("/kaldeva/jobs/:id/cancel", verifyToken, async (req, res) => {
  const actorId = String(req.user?.id || "");
  if (!actorId) return res.status(401).json({ success: false, error: "Brak użytkownika." });
  const id = String(req.params.id);
  try {
    const saved = await prisma.history.findFirst({
      where: { id, userId: actorId, type: KALDEVA_HISTORY_TYPE },
      select: { report: true }
    });
    if (!saved) return res.status(404).json({ success: false, error: "Nie znaleziono zlecenia." });
    if (saved.report?.status !== "queued")
      return res.status(409).json({ success: false, error: "Można anulować tylko oczekujące zlecenie." });
    // Conditional update prevents cancelling a job already picked up by the worker.
    const cancelled = { ...saved.report, status: "cancelled", updatedAt: new Date().toISOString() };
    const updated = await prisma.$executeRaw`
      UPDATE "History" SET "report" = ${JSON.stringify(cancelled)}::jsonb
      WHERE "id" = ${id} AND "userId" = ${actorId}
        AND "type" = ${KALDEVA_HISTORY_TYPE}
        AND "report"->>'status' = 'queued'
    `;
    if (!updated) return res.status(409).json({ success: false, error: "Zlecenie zostało już podjęte przez worker." });
    return res.json({ success: true, data: cancelled });
  } catch (error) {
    console.error("kaldeva_cancel_persistence_error", error?.name || "Error");
    return res.status(503).json({ success: false, error: "Nie udało się anulować zlecenia." });
  }
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
