import { Router } from "express";
import {
  getCategories,
  getCategoryBySlug,
  getCategoriesAdmin,
  createCategory,
  updateCategory,
  deleteCategory,
} from "../controllers/categories.controller.js";
import { protectAdmin } from "../middleware/auth.js";

const router = Router();

router.get("/", getCategories);
router.get("/admin/all", protectAdmin, getCategoriesAdmin);
router.post("/", protectAdmin, createCategory);
router.put("/:id", protectAdmin, updateCategory);
router.delete("/:id", protectAdmin, deleteCategory);
router.get("/:slug", getCategoryBySlug);

export default router;
