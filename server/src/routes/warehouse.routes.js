import { Router } from "express";
import { getOverview, createReceipt, createAdjustment, getEntries } from "../controllers/warehouse.controller.js";
import { protectAdmin } from "../middleware/auth.js";

const router = Router();

router.get("/overview", protectAdmin, getOverview);
router.get("/entries", protectAdmin, getEntries);
router.post("/receipts", protectAdmin, createReceipt);
router.post("/adjustments", protectAdmin, createAdjustment);

export default router;
