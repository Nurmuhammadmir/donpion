import asyncHandler from "express-async-handler";
import Category from "../models/Category.js";
import Product from "../models/Product.js";
import { slugifyRu } from "../utils/slugify.js";
import { notifyRevalidate } from "../utils/notifyRevalidate.js";

// GET /api/categories  (public — active only)
export const getCategories = asyncHandler(async (req, res) => {
  const categories = await Category.find({ isActive: true }).sort({ sortOrder: 1, name: 1 });
  res.json(categories);
});

// GET /api/categories/:slug  (public)
export const getCategoryBySlug = asyncHandler(async (req, res) => {
  const category = await Category.findOne({ slug: req.params.slug, isActive: true });
  if (!category) {
    res.status(404);
    throw new Error("Category not found");
  }
  res.json(category);
});

// GET /api/admin/categories  (admin — includes inactive)
export const getCategoriesAdmin = asyncHandler(async (req, res) => {
  const categories = await Category.find({}).sort({ sortOrder: 1, name: 1 });
  res.json(categories);
});

// POST /api/admin/categories  (admin)
export const createCategory = asyncHandler(async (req, res) => {
  const body = req.body;
  if (!String(body.name || "").trim()) {
    res.status(400);
    throw new Error("Название категории обязательно");
  }
  const slug = body.slug ? slugifyRu(body.slug) : slugifyRu(body.name);

  const category = await Category.create({ ...body, slug });
  notifyRevalidate();
  res.status(201).json(category);
});

// PUT /api/admin/categories/:id  (admin)
export const updateCategory = asyncHandler(async (req, res) => {
  const category = await Category.findById(req.params.id);
  if (!category) {
    res.status(404);
    throw new Error("Category not found");
  }

  const body = { ...req.body };
  if (body.slug) body.slug = slugifyRu(body.slug);

  Object.assign(category, body);
  await category.save();
  notifyRevalidate();
  res.json(category);
});

// DELETE /api/admin/categories/:id  (admin)
export const deleteCategory = asyncHandler(async (req, res) => {
  const category = await Category.findById(req.params.id);
  if (!category) {
    res.status(404);
    throw new Error("Category not found");
  }
  // Product.category is required and always .populate()'d on the public
  // product page — an orphaned reference there is a 500, not a 404, for
  // every visitor to that product until someone notices and fixes it.
  const inUse = await Product.countDocuments({ category: category._id });
  if (inUse > 0) {
    res.status(400);
    throw new Error(`Категория используется в товарах (${inUse}) — сначала перенесите или удалите их`);
  }
  await category.deleteOne();
  notifyRevalidate();
  res.json({ message: "Category deleted" });
});
