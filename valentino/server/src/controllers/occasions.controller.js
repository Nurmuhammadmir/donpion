import asyncHandler from "express-async-handler";
import Occasion from "../models/Occasion.js";
import Product from "../models/Product.js";
import { slugifyRu } from "../utils/slugify.js";
import { notifyRevalidate } from "../utils/notifyRevalidate.js";

// GET /api/occasions  (public — active only)
export const getOccasions = asyncHandler(async (req, res) => {
  const occasions = await Occasion.find({ isActive: true }).sort({ sortOrder: 1, name: 1 });
  res.json(occasions);
});

// GET /api/occasions/:slug  (public)
export const getOccasionBySlug = asyncHandler(async (req, res) => {
  const occasion = await Occasion.findOne({ slug: req.params.slug, isActive: true });
  if (!occasion) {
    res.status(404);
    throw new Error("Occasion not found");
  }
  res.json(occasion);
});

// GET /api/occasions/admin/all  (admin — includes inactive)
export const getOccasionsAdmin = asyncHandler(async (req, res) => {
  const occasions = await Occasion.find({}).sort({ sortOrder: 1, name: 1 });
  res.json(occasions);
});

// POST /api/occasions  (admin)
export const createOccasion = asyncHandler(async (req, res) => {
  const body = req.body;
  if (!String(body.name || "").trim()) {
    res.status(400);
    throw new Error("Название обязательно");
  }
  const slug = body.slug ? slugifyRu(body.slug) : slugifyRu(body.name);
  const occasion = await Occasion.create({ ...body, slug });
  notifyRevalidate();
  res.status(201).json(occasion);
});

// PUT /api/occasions/:id  (admin)
export const updateOccasion = asyncHandler(async (req, res) => {
  const occasion = await Occasion.findById(req.params.id);
  if (!occasion) {
    res.status(404);
    throw new Error("Occasion not found");
  }
  const body = { ...req.body };
  if (body.slug) body.slug = slugifyRu(body.slug);
  Object.assign(occasion, body);
  await occasion.save();
  notifyRevalidate();
  res.json(occasion);
});

// DELETE /api/occasions/:id  (admin)
export const deleteOccasion = asyncHandler(async (req, res) => {
  const occasion = await Occasion.findById(req.params.id);
  if (!occasion) {
    res.status(404);
    throw new Error("Occasion not found");
  }
  const inUse = await Product.countDocuments({ occasions: occasion._id });
  if (inUse > 0) {
    res.status(400);
    throw new Error(`Повод используется в товарах (${inUse}) — сначала уберите его у них`);
  }
  await occasion.deleteOne();
  notifyRevalidate();
  res.json({ message: "Occasion deleted" });
});
