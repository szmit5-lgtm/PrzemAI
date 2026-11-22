const express = require("express");
const FinanceController = require("../controllers/FinanceController");
const verifyToken = require("../middleware/verifyToken");

const router = express.Router();
const controller = new FinanceController();
const {OperationalStatusService}=require("../services/OperationalStatusService");
const operations=new OperationalStatusService();
router.get("/history/status",verifyToken,async(req,res)=>{
 try{return res.json({success:true,data:await operations.ksef(req.user.id)});}
 catch(error){const status=error?.status===403?403:500;
  return res.status(status).json({success:false,error:status===403?error.message:"Nie udało się pobrać statusu historii KSeF."});}
});

router.get(
    "/documents",
    verifyToken,
    (req, res) =>
        controller.list(req, res)
);

router.post("/history/import", verifyToken, (req, res) => controller.queueKsefBackfill(req, res));
router.get("/reports/periods",verifyToken,(req,res)=>controller.reportPeriods(req,res));
router.patch("/documents/:id/accounting",verifyToken,(req,res)=>controller.classifyExpense(req,res));
router.get("/projects", verifyToken, (req, res) => controller.projects(req, res));
router.post("/projects", verifyToken, (req, res) => controller.createProject(req, res));
router.patch("/projects/:id/organization", verifyToken, (req, res) => controller.shareLegacyProject(req, res));
router.put("/projects/:id/access/:userId", verifyToken, (req, res) => controller.setProjectAccess(req, res));
router.delete("/projects/:id/access/:userId", verifyToken, (req, res) => controller.setProjectAccess(req, res));
router.patch("/documents/:id/project", verifyToken, (req, res) => controller.assignProject(req, res));

router.get(
    "/documents/:id",
    verifyToken,
    (req, res) => controller.one(req, res)
);

router.get(
    "/summary",
    verifyToken,
    (req, res) =>
        controller.summary(req, res)
);

module.exports = router;
