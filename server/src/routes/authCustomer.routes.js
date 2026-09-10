import { Router } from "express";
import rateLimit from "express-rate-limit";
import {
  registerCustomer,
  getVerificationStatus,
  verifyCustomer,
  getCurrentCustomer,
  logoutCustomer,
} from "../controllers/authCustomer.controller.js";
import { protectCustomer } from "../middleware/customerAuth.js";

const router = Router();

// Each registration attempt sends a real, paid Telegram Gateway message
// (~$0.01/code) — with no throttling, a loop hitting this endpoint drains
// the account balance and locks out real customers. 5 requests per 15
// minutes per IP is generous for a genuine visitor retrying a typo/missed
// code, but shuts down a scripted loop fast.
const registerLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Слишком много попыток, попробуйте позже" },
});

router.post("/register", registerLimiter, registerCustomer);
router.get("/status/:registrationId", getVerificationStatus);
router.post("/verify", verifyCustomer);
router.get("/me", protectCustomer, getCurrentCustomer);
router.post("/logout", logoutCustomer);

export default router;
