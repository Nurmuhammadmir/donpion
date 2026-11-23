import { Router } from "express";
import {
  createOrder,
  createPosOrder,
  getMyOrders,
  getOrders,
  getOrderById,
  updateOrderStatus,
  sendAssemblyPhoto,
  getOrderStats,
  clearOrders,
} from "../controllers/orders.controller.js";
import { protectAdmin } from "../middleware/auth.js";
import { protectCustomer } from "../middleware/customerAuth.js";

const router = Router();

router.post("/", protectCustomer, createOrder);
router.get("/mine", protectCustomer, getMyOrders);
router.get("/stats", protectAdmin, getOrderStats);
router.post("/pos", protectAdmin, createPosOrder);
router.get("/", protectAdmin, getOrders);
router.delete("/", protectAdmin, clearOrders);
router.get("/:id", protectAdmin, getOrderById);
router.patch("/:id/status", protectAdmin, updateOrderStatus);
router.post("/:id/send-photo", protectAdmin, sendAssemblyPhoto);

export default router;
