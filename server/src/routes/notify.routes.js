import { Router } from "express";
import { notifyVisit } from "../controllers/notify.controller.js";

const router = Router();

router.post("/visit", notifyVisit);

export default router;
