import asyncHandler from "express-async-handler";
import AddonCategory from "../models/AddonCategory.js";
import Product from "../models/Product.js";
import { slugifyRu } from "../utils/slugify.js";
import { notifyRevalidate } from "../utils/notifyRevalidate.js";

// GET /api/addon-categories  (public — active only)
export const getAddonCategories = asyncHandler(async (req, res) => {
  const categories = await AddonCategory.find({ isActive: true }).sort({ sortOrder: 1, name: 1 });
  res.json(categories);
});

// GET /api/addon-categories/:slug  (public)
export const getAddonCategoryBySlug = asyncHandler(async (req, res) => {
  const category = await AddonCategory.findOne({ slug: req.params.slug, isActive: true });
  if (!category) {
    res.status(404);
    throw new Error("Addon category not found");
  }
  res.json(category);
});

// GET /api/addon-categories/admin/all  (admin — includes inactive)
export const getAddonCategoriesAdmin = asyncHandler(async (req, res) => {
  const categories = await AddonCategory.find({}).sort({ sortOrder: 1, name: 1 });
  res.json(categories);
});

// POST /api/addon-categories  (admin)
export const createAddonCategory = asyncHandler(async (req, res) => {
  const body = req.body;
  if (!String(body.name || "").trim()) {
    res.status(400);
    throw new Error("Название обязательно");
  }
  const slug = body.slug ? slugifyRu(body.slug) : slugifyRu(body.name);
  const category = await AddonCategory.create({ ...body, slug });
  notifyRevalidate();
  res.status(201).json(category);
});

// PUT /api/addon-categories/:id  (admin)
export const updateAddonCategory = asyncHandler(async (req, res) => {
  const category = await AddonCategory.findById(req.params.id);
  if (!category) {
    res.status(404);
    throw new Error("Addon category not found");
  }
  const body = { ...req.body };
  if (body.slug) body.slug = slugifyRu(body.slug);
  Object.assign(category, body);
  await category.save();
  notifyRevalidate();
  res.json(category);
});

// DELETE /api/addon-categories/:id  (admin)
export const deleteAddonCategory = asyncHandler(async (req, res) => {
  const category = await AddonCategory.findById(req.params.id);
  if (!category) {
    res.status(404);
    throw new Error("Addon category not found");
  }
  const inUse = await Product.countDocuments({ addonCategories: category._id });
  if (inUse > 0) {
    res.status(400);
    throw new Error(`Категория допов используется в товарах (${inUse}) — сначала уберите её у них`);
  }
  await category.deleteOne();
  notifyRevalidate();
  res.json({ message: "Addon category deleted" });
});
