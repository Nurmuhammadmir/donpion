import { Router } from "express";
import {
  getOverview,
  createReceipt,
  createAdjustment,
  getEntries,
  getSuppliers,
  createSupplier,
  updateSupplier,
  deleteSupplier,
  getBatches,
  createBatch,
} from "../controllers/warehouse.controller.js";
import { protectAdmin } from "../middleware/auth.js";

const router = Router();

router.get("/overview", protectAdmin, getOverview);
router.get("/entries", protectAdmin, getEntries);
router.post("/receipts", protectAdmin, createReceipt);
router.post("/adjustments", protectAdmin, createAdjustment);

router.get("/suppliers", protectAdmin, getSuppliers);
router.post("/suppliers", protectAdmin, createSupplier);
router.put("/suppliers/:id", protectAdmin, updateSupplier);
router.delete("/suppliers/:id", protectAdmin, deleteSupplier);

router.get("/batches", protectAdmin, getBatches);
router.post("/batches", protectAdmin, createBatch);

export default router;
