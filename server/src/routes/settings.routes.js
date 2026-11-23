import { Router } from "express";
import { getSettings, updateSettings, getPricingSettings } from "../controllers/settings.controller.js";
import { protectAdmin } from "../middleware/auth.js";

const router = Router();

router.get("/", getSettings);
router.get("/pricing", protectAdmin, getPricingSettings);
router.put("/", protectAdmin, updateSettings);

export default router;
