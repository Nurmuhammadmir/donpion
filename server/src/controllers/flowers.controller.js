import asyncHandler from "express-async-handler";
import Flower from "../models/Flower.js";
import { recomputeBouquetsUsingFlower } from "../utils/bouquetStock.js";

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
export const createFlower = asyncHandler(async (req, res) => {
  const { name, category } = req.body;
  if (!String(name || "").trim() || !category) {
    res.status(400);
    throw new Error("Укажите название и категорию цветка");
  }
  const flower = await Flower.create({ name: name.trim(), category, unit: req.body.unit || "шт" });
  res.status(201).json(flower);
});

// PUT /api/flowers/:id  (admin)
export const updateFlower = asyncHandler(async (req, res) => {
  const flower = await Flower.findById(req.params.id);
  if (!flower) {
    res.status(404);
    throw new Error("Цветок не найден");
  }
  Object.assign(flower, req.body);
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
