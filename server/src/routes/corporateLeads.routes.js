import { Router } from "express";
import { createCorporateLead, getCorporateLeads, updateCorporateLeadStatus } from "../controllers/corporateLeads.controller.js";
import { protectAdmin } from "../middleware/auth.js";

const router = Router();

router.post("/", createCorporateLead);
router.get("/", protectAdmin, getCorporateLeads);
router.patch("/:id", protectAdmin, updateCorporateLeadStatus);

export default router;
