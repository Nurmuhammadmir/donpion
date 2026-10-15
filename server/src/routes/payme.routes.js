import { Router } from "express";
import express from "express";
import { paymeHandler } from "../controllers/payme.controller.js";

const router = Router();

// Payme's documented example sends `Content-Type: text/json`, not the
// standard application/json the global express.json() in server.js
// matches by default — same situation as click.routes.js's urlencoded body,
// so this router parses its own body instead of relying on the global one.
router.use(express.json({ type: ["application/json", "text/json"] }));

router.post("/", paymeHandler);

export default router;
