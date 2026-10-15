import { Router } from "express";
import {
  getBranches,
  getBranchesAdmin,
  createBranch,
  updateBranch,
  deleteBranch,
} from "../controllers/branches.controller.js";
import { protectAdmin } from "../middleware/auth.js";

const router = Router();

router.get("/", getBranches);
router.get("/admin/all", protectAdmin, getBranchesAdmin);
router.post("/", protectAdmin, createBranch);
router.put("/:id", protectAdmin, updateBranch);
router.delete("/:id", protectAdmin, deleteBranch);

export default router;
