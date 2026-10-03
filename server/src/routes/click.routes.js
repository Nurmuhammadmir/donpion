import { Router } from "express";
import express from "express";
import { clickPrepare, clickComplete } from "../controllers/click.controller.js";

const router = Router();

// Click's Shop API posts application/x-www-form-urlencoded, not JSON — the
// global express.json() in server.js won't parse that, so this router
// parses its own body instead of relying on it.
router.use(express.urlencoded({ extended: true }));

router.post("/prepare", clickPrepare);
router.post("/complete", clickComplete);

export default router;
