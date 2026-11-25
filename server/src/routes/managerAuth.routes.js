import { Router } from "express";
import rateLimit from "express-rate-limit";
import { managerLogin, managerMe } from "../controllers/managerAuth.controller.js";
import { protectManager } from "../middleware/managerAuth.js";

const router = Router();

// Admin login has no rate limit today, but Manager is a new, lower-trust,
// likely-more-numerous credential set — same shape as authCustomer.routes.js's
// registerLimiter, just guarding a login instead of a paid SMS send.
const managerLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Слишком много попыток, попробуйте позже" },
});

router.post("/login", managerLoginLimiter, managerLogin);
router.get("/me", protectManager, managerMe);

export default router;
