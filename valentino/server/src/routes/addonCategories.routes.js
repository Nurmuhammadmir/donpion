import { Router } from "express";
import {
  getAddonCategories,
  getAddonCategoryBySlug,
  getAddonCategoriesAdmin,
  createAddonCategory,
  updateAddonCategory,
  deleteAddonCategory,
} from "../controllers/addonCategories.controller.js";
import { protectAdmin } from "../middleware/auth.js";

const router = Router();

router.get("/", getAddonCategories);
router.get("/admin/all", protectAdmin, getAddonCategoriesAdmin);
router.post("/", protectAdmin, createAddonCategory);
router.put("/:id", protectAdmin, updateAddonCategory);
router.delete("/:id", protectAdmin, deleteAddonCategory);
router.get("/:slug", getAddonCategoryBySlug);

export default router;
