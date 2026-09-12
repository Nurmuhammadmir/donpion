import { Router } from "express";
import {
  getOccasions,
  getOccasionBySlug,
  getOccasionsAdmin,
  createOccasion,
  updateOccasion,
  deleteOccasion,
} from "../controllers/occasions.controller.js";
import { protectAdmin } from "../middleware/auth.js";

const router = Router();

router.get("/", getOccasions);
router.get("/admin/all", protectAdmin, getOccasionsAdmin);
router.post("/", protectAdmin, createOccasion);
router.put("/:id", protectAdmin, updateOccasion);
router.delete("/:id", protectAdmin, deleteOccasion);
router.get("/:slug", getOccasionBySlug);

export default router;
