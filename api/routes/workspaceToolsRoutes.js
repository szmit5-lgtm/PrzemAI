const express = require("express");
const verifyToken = require("../middleware/verifyToken");
const WorkspaceToolsService = require("../services/WorkspaceToolsService");
const { OrganizationError } = require("../services/OrganizationService");

const router = express.Router();
const service = new WorkspaceToolsService();

function handleError(res, error) {
  if (error instanceof OrganizationError) {
    return res.status(error.status).json({ error: error.message });
  }
  console.error("Workspace operation failed", error?.name, error?.code);
  return res.status(500).json({ error: "Nie udało się odczytać danych przestrzeni roboczej." });
}

router.post("/search", verifyToken, async (req, res) => {
  try {
    return res.json(await service.search(req.user.id, req.body?.query, req.body?.organizationId));
  } catch (error) {
    return handleError(res, error);
  }
});

router.get("/personal-export", verifyToken, async (req, res) => {
  try {
    const data = await service.exportPersonal(req.user.id);
    res.attachment("przemai-eksport-osobisty.json");
    return res.json(data);
  } catch (error) {
    return handleError(res, error);
  }
});

module.exports = router;
