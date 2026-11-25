import { Router } from "express";
import { createSiteLead } from "../controllers/leads.controller.js";

const router = Router();

// Public creation only — GET/PATCH (manager-facing) live under
// /api/manager/leads instead, see routes/manager.routes.js.
router.post("/", createSiteLead);

export default router;
