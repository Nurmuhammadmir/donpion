import { Router } from "express";
import { uploadProductImages } from "../controllers/uploads.controller.js";
import { uploadImages } from "../middleware/upload.js";
import { protectAdmin } from "../middleware/auth.js";

const router = Router();

router.post("/", protectAdmin, uploadImages.array("images", 6), uploadProductImages);

export default router;
