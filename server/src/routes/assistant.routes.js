import { Router } from "express";
import { getMorningReport } from "../controllers/assistant.controller.js";
import { protectAssistant } from "../middleware/assistantAuth.js";

const router = Router();

router.get("/morning-report", protectAssistant, getMorningReport);

export default router;
