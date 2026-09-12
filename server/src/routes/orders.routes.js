import { Router } from "express";
import {
  createOrder,
  getMyOrders,
  getOrders,
  getOrderById,
  updateOrderStatus,
  getOrderStats,
} from "../controllers/orders.controller.js";
import { protectAdmin } from "../middleware/auth.js";
import { protectCustomer } from "../middleware/customerAuth.js";

const router = Router();

router.post("/", protectCustomer, createOrder);
router.get("/mine", protectCustomer, getMyOrders);
router.get("/stats", protectAdmin, getOrderStats);
router.get("/", protectAdmin, getOrders);
router.get("/:id", protectAdmin, getOrderById);
router.patch("/:id/status", protectAdmin, updateOrderStatus);

export default router;
