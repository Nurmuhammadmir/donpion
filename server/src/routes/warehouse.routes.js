import { Router } from "express";
import {
  getOverview,
  createReceipt,
  createAdjustment,
  getEntries,
  clearEntries,
  getSuppliers,
  createSupplier,
  updateSupplier,
  deleteSupplier,
  getBatches,
  createBatch,
  getExchangeRate,
} from "../controllers/warehouse.controller.js";
import { protectAdmin } from "../middleware/auth.js";

const router = Router();

router.get("/overview", protectAdmin, getOverview);
router.get("/entries", protectAdmin, getEntries);
router.delete("/entries", protectAdmin, clearEntries);
router.post("/receipts", protectAdmin, createReceipt);
router.post("/adjustments", protectAdmin, createAdjustment);

router.get("/suppliers", protectAdmin, getSuppliers);
router.post("/suppliers", protectAdmin, createSupplier);
router.put("/suppliers/:id", protectAdmin, updateSupplier);
router.delete("/suppliers/:id", protectAdmin, deleteSupplier);

router.get("/batches", protectAdmin, getBatches);
router.post("/batches", protectAdmin, createBatch);
router.get("/exchange-rate", protectAdmin, getExchangeRate);

export default router;
