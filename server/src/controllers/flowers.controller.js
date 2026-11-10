import asyncHandler from "express-async-handler";
import Flower from "../models/Flower.js";
import Category from "../models/Category.js";
import { recomputeBouquetsUsingFlower } from "../utils/bouquetStock.js";

// The admin never picks a flower's category — "само цветок... оно само
// как категория" (the flower's own name already tells you its category).
// Matched against the name's FIRST WORD only, never a substring search of
// the whole name: every flower here is named "[Тип] [цвет/сорт]" ("Роза
// красная", "Тюльпан розовый"), and a colour adjective can share a root
// with an unrelated flower's name ("розовый" contains "роз", so a
// whole-string search would wrongly file a pink tulip under "Розы").
// Checking only the leading word avoids that collision entirely. Stems
// are each real category's name minus its trailing letter (crude Russian
// de-pluralization: "Розы"->"роз", "Тюльпаны"->"тюльпан"). "Разное" is
// the catch-all, never a match target — a name matching nothing just gets
// no category (a bouquet built from it falls back to ensureCategory's own
// "Разное" default, same as always).
async function deriveCategoryFromName(name) {
  const categories = await Category.find({ slug: { $ne: "raznoe" } })
    .select("name")
    .sort({ sortOrder: 1 });
  const firstWord = name.trim().toLowerCase().split(/\s+/)[0] || "";
  for (const cat of categories) {
    const stem = cat.name.toLowerCase().slice(0, -1);
    if (stem.length >= 3 && firstWord.startsWith(stem)) return cat._id;
  }
  return null;
}

// GET /api/flowers?search=&limit=  (admin) — the picker used both by
// "Приход" (Склад) and a bouquet's recipe editor (Витрина).
export const getFlowers = asyncHandler(async (req, res) => {
  const { search, limit = 100 } = req.query;
  const filter = {};
  if (search) filter.name = { $regex: String(search), $options: "i" };

  const flowers = await Flower.find(filter).populate("category", "name").sort({ name: 1 }).limit(Number(limit));
  res.json(flowers);
});

// POST /api/flowers  (admin) — "создаются": a new flower type, right from
// the same picker, the moment it's needed instead of a separate detour.
// Just a name — category is derived automatically, never asked for.
export const createFlower = asyncHandler(async (req, res) => {
  const { name } = req.body;
  if (!String(name || "").trim()) {
    res.status(400);
    throw new Error("Укажите название цветка");
  }
  const trimmed = name.trim();
  const category = await deriveCategoryFromName(trimmed);
  const flower = await Flower.create({ name: trimmed, category, unit: req.body.unit || "шт" });
  res.status(201).json(flower);
});

// PUT /api/flowers/:id  (admin) — renaming re-derives the category the
// same automatic way; category is never accepted from the request body.
export const updateFlower = asyncHandler(async (req, res) => {
  const flower = await Flower.findById(req.params.id);
  if (!flower) {
    res.status(404);
    throw new Error("Цветок не найден");
  }
  const { category: _ignored, ...rest } = req.body;
  Object.assign(flower, rest);
  if (rest.name) flower.category = await deriveCategoryFromName(rest.name);
  await flower.save();
  await recomputeBouquetsUsingFlower(flower._id);
  res.json(flower);
});

// DELETE /api/flowers/:id  (admin)
export const deleteFlower = asyncHandler(async (req, res) => {
  const flower = await Flower.findById(req.params.id);
  if (!flower) {
    res.status(404);
    throw new Error("Цветок не найден");
  }
  await flower.deleteOne();
  res.json({ message: "Flower deleted" });
});
