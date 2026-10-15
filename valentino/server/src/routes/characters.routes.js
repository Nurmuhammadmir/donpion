import { Router } from "express";
import {
  getCharacters,
  getCharacterBySlug,
  getCharactersAdmin,
  createCharacter,
  updateCharacter,
  deleteCharacter,
} from "../controllers/characters.controller.js";
import { protectAdmin } from "../middleware/auth.js";

const router = Router();

router.get("/", getCharacters);
router.get("/admin/all", protectAdmin, getCharactersAdmin);
router.post("/", protectAdmin, createCharacter);
router.put("/:id", protectAdmin, updateCharacter);
router.delete("/:id", protectAdmin, deleteCharacter);
router.get("/:slug", getCharacterBySlug);

export default router;
