import { Router } from "express";
import {
  createSubscription,
  getMySubscriptions,
  getSubscriptionsAdmin,
  markDeliveryDelivered,
  skipDelivery,
  cancelSubscription,
  skipMyDelivery,
  swapMyDeliveryBouquet,
  cancelMySubscription,
} from "../controllers/subscriptions.controller.js";
import { protectAdmin } from "../middleware/auth.js";
import { protectCustomer } from "../middleware/customerAuth.js";

const router = Router();

router.post("/", protectCustomer, createSubscription);
router.get("/mine", protectCustomer, getMySubscriptions);
router.patch("/mine/:id/deliveries/:date/bouquet", protectCustomer, swapMyDeliveryBouquet);
router.patch("/mine/:id/deliveries/:date/skip", protectCustomer, skipMyDelivery);
router.patch("/mine/:id/cancel", protectCustomer, cancelMySubscription);
router.get("/", protectAdmin, getSubscriptionsAdmin);
router.patch("/:id/deliveries/:date/deliver", protectAdmin, markDeliveryDelivered);
router.patch("/:id/deliveries/:date/skip", protectAdmin, skipDelivery);
router.patch("/:id/cancel", protectAdmin, cancelSubscription);

export default router;
