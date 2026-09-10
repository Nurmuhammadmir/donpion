import { Router } from "express";
import {
  getProducts,
  getProductBySlug,
  getProductsAdmin,
  getProductByIdAdmin,
  createProduct,
  updateProduct,
  deleteProduct,
} from "../controllers/products.controller.js";
import { protectAdmin } from "../middleware/auth.js";

const router = Router();

router.get("/", getProducts);
router.get("/admin/all", protectAdmin, getProductsAdmin);
router.get("/admin/id/:id", protectAdmin, getProductByIdAdmin);
router.post("/", protectAdmin, createProduct);
router.put("/:id", protectAdmin, updateProduct);
router.delete("/:id", protectAdmin, deleteProduct);
router.get("/:slug", getProductBySlug);

export default router;
