import { Router } from "express";
import { verifyInstagramWebhook, receiveInstagramWebhook } from "../controllers/instagram.controller.js";

const router = Router();

// No body-parser of its own, unlike click.routes.js/payme.routes.js — Meta
// sends Content-Type: application/json, which the GLOBAL express.json() in
// server.js already consumes before a router-level parser here could run.
// Signature verification instead reads req.rawBody, captured by that
// global parser's own `verify` callback (see server.js).
router.get("/webhook", verifyInstagramWebhook);
router.post("/webhook", receiveInstagramWebhook);

export default router;
