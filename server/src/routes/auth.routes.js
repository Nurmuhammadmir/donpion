import { Router } from "express";
import { login, me } from "../controllers/auth.controller.js";
import { protectAdmin } from "../middleware/auth.js";

const router = Router();

router.post("/login", login);
router.get("/me", protectAdmin, me);

export default router;
