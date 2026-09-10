import asyncHandler from "express-async-handler";
import Character from "../models/Character.js";
import Product from "../models/Product.js";
import { slugifyRu } from "../utils/slugify.js";
import { notifyRevalidate } from "../utils/notifyRevalidate.js";

// GET /api/characters  (public — active only)
export const getCharacters = asyncHandler(async (req, res) => {
  const characters = await Character.find({ isActive: true }).sort({ sortOrder: 1, name: 1 });
  res.json(characters);
});

// GET /api/characters/:slug  (public)
export const getCharacterBySlug = asyncHandler(async (req, res) => {
  const character = await Character.findOne({ slug: req.params.slug, isActive: true });
  if (!character) {
    res.status(404);
    throw new Error("Character not found");
  }
  res.json(character);
});

// GET /api/characters/admin/all  (admin — includes inactive)
export const getCharactersAdmin = asyncHandler(async (req, res) => {
  const characters = await Character.find({}).sort({ sortOrder: 1, name: 1 });
  res.json(characters);
});

// POST /api/characters  (admin)
export const createCharacter = asyncHandler(async (req, res) => {
  const body = req.body;
  if (!String(body.name || "").trim()) {
    res.status(400);
    throw new Error("Название характера обязательно");
  }
  const slug = body.slug ? slugifyRu(body.slug) : slugifyRu(body.name);
  const character = await Character.create({ ...body, slug });
  notifyRevalidate();
  res.status(201).json(character);
});

// PUT /api/characters/:id  (admin)
export const updateCharacter = asyncHandler(async (req, res) => {
  const character = await Character.findById(req.params.id);
  if (!character) {
    res.status(404);
    throw new Error("Character not found");
  }
  const body = { ...req.body };
  if (body.slug) body.slug = slugifyRu(body.slug);
  Object.assign(character, body);
  await character.save();
  notifyRevalidate();
  res.json(character);
});

// DELETE /api/characters/:id  (admin)
export const deleteCharacter = asyncHandler(async (req, res) => {
  const character = await Character.findById(req.params.id);
  if (!character) {
    res.status(404);
    throw new Error("Character not found");
  }
  const inUse = await Product.countDocuments({ characters: character._id });
  if (inUse > 0) {
    res.status(400);
    throw new Error(`Характер используется в товарах (${inUse}) — сначала перенесите или удалите их`);
  }
  await character.deleteOne();
  notifyRevalidate();
  res.json({ message: "Character deleted" });
});
