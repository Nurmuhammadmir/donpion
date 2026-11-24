import { Router } from "express";
import {
  createSubscription,
  getMySubscriptions,
  getSubscriptionsAdmin,
  markDeliveryDelivered,
  skipDelivery,
  cancelSubscription,
} from "../controllers/subscriptions.controller.js";
import { protectAdmin } from "../middleware/auth.js";
import { protectCustomer } from "../middleware/customerAuth.js";

const router = Router();

router.post("/", protectCustomer, createSubscription);
router.get("/mine", protectCustomer, getMySubscriptions);
router.get("/", protectAdmin, getSubscriptionsAdmin);
router.patch("/:id/deliveries/:date/deliver", protectAdmin, markDeliveryDelivered);
router.patch("/:id/deliveries/:date/skip", protectAdmin, skipDelivery);
router.patch("/:id/cancel", protectAdmin, cancelSubscription);

export default router;
