import { Router } from "express";
import { getFlowers, createFlower, updateFlower, deleteFlower } from "../controllers/flowers.controller.js";
import { protectAdmin } from "../middleware/auth.js";

const router = Router();

router.get("/", protectAdmin, getFlowers);
router.post("/", protectAdmin, createFlower);
router.put("/:id", protectAdmin, updateFlower);
router.delete("/:id", protectAdmin, deleteFlower);

export default router;
