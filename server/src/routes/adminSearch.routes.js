import { Router } from "express";
import { globalSearch } from "../controllers/adminSearch.controller.js";
import { protectAdmin } from "../middleware/auth.js";

const router = Router();

router.get("/search", protectAdmin, globalSearch);

export default router;
