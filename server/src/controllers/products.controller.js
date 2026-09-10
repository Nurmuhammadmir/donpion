import asyncHandler from "express-async-handler";
import Product from "../models/Product.js";
import Category from "../models/Category.js";
import Character from "../models/Character.js";
import { slugifyRu } from "../utils/slugify.js";
import { notifyRevalidate } from "../utils/notifyRevalidate.js";

// A product left untagged by the admin still needs to show up in the
// homepage quiz's results, so it gets a random active Character instead of
// none at all. Stored for real (not computed on read), so the admin can see
// and change it afterwards like any other field.
async function ensureCharacters(characterIds) {
  if (Array.isArray(characterIds) && characterIds.length > 0) return characterIds;

  const activeCharacters = await Character.find({ isActive: true }).select("_id");
  if (activeCharacters.length === 0) return [];

  const pick = activeCharacters[Math.floor(Math.random() * activeCharacters.length)];
  return [pick._id];
}

// The admin only ever types a name and a short description — asking for a
// separate SEO title/description on top of that was pure duplicate typing,
// so both are derived here instead of being admin-entered fields.
function deriveSeoFields(name, shortDescription) {
  return {
    seoTitle: `${name} — купить с доставкой в Ташкенте | DonPion`,
    seoDescription: shortDescription,
  };
}

// Query params come from `qs`, which turns bracket notation into nested
// objects (e.g. ?search[$ne]=1 -> { search: { $ne: '1' } }) — passed
// straight into a Mongoose filter that's an operator-injection vector.
// Coercing to a plain string (or dropping the param) closes that off.
function asQueryString(value) {
  return typeof value === "string" ? value : undefined;
}

// GET /api/products?category=rozy&character=..&search=..&featured=true&page=1&limit=24
export const getProducts = asyncHandler(async (req, res) => {
  const { page = 1, limit = 24 } = req.query;
  const category = asQueryString(req.query.category);
  const character = asQueryString(req.query.character);
  const search = asQueryString(req.query.search);
  const featured = asQueryString(req.query.featured);

  const filter = { isActive: true };

  if (category) {
    const cat = await Category.findOne({ slug: category });
    if (!cat) return res.json({ items: [], total: 0, page: Number(page), pages: 0 });
    filter.category = cat._id;
  }

  if (character) {
    const char = await Character.findOne({ slug: character });
    if (!char) return res.json({ items: [], total: 0, page: Number(page), pages: 0 });
    filter.characters = char._id;
  }

  if (featured === "true") filter.isFeatured = true;
  if (search) filter.$text = { $search: search };

  const skip = (Number(page) - 1) * Number(limit);

  const [items, total] = await Promise.all([
    Product.find(filter)
      .populate("category", "name slug")
      .populate("characters", "name slug")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit)),
    Product.countDocuments(filter),
  ]);

  res.json({
    items,
    total,
    page: Number(page),
    pages: Math.ceil(total / Number(limit)),
  });
});

// GET /api/products/:slug  (public)
export const getProductBySlug = asyncHandler(async (req, res) => {
  const product = await Product.findOne({ slug: req.params.slug, isActive: true }).populate(
    "category",
    "name slug"
  );
  if (!product) {
    res.status(404);
    throw new Error("Product not found");
  }

  const related = await Product.find({
    category: product.category._id,
    _id: { $ne: product._id },
    isActive: true,
  })
    .limit(4)
    .select("name slug price oldPrice images rating stock");

  res.json({ product, related });
});

// GET /api/admin/products  (admin — includes inactive, simple pagination)
export const getProductsAdmin = asyncHandler(async (req, res) => {
  const { page = 1, limit = 50 } = req.query;
  const search = asQueryString(req.query.search);
  const filter = {};
  if (search) filter.$text = { $search: search };

  const skip = (Number(page) - 1) * Number(limit);
  const [items, total] = await Promise.all([
    Product.find(filter).populate("category", "name slug").sort({ createdAt: -1 }).skip(skip).limit(Number(limit)),
    Product.countDocuments(filter),
  ]);

  res.json({ items, total, page: Number(page), pages: Math.ceil(total / Number(limit)) });
});

// GET /api/products/admin/id/:id  (admin — fetch one product, including inactive, for editing)
export const getProductByIdAdmin = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id)
    .populate("category", "name slug")
    .populate("characters", "name slug");
  if (!product) {
    res.status(404);
    throw new Error("Product not found");
  }
  res.json(product);
});

// POST /api/admin/products  (admin)
export const createProduct = asyncHandler(async (req, res) => {
  const body = req.body;
  if (!String(body.name || "").trim()) {
    res.status(400);
    throw new Error("Название товара обязательно");
  }
  const slug = body.slug ? slugifyRu(body.slug) : slugifyRu(body.name);
  const characters = await ensureCharacters(body.characters);
  const { seoTitle, seoDescription } = deriveSeoFields(body.name, body.shortDescription);

  const product = await Product.create({ ...body, slug, characters, seoTitle, seoDescription });
  notifyRevalidate();
  res.status(201).json(product);
});

// PUT /api/admin/products/:id  (admin)
export const updateProduct = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) {
    res.status(404);
    throw new Error("Product not found");
  }

  const body = { ...req.body };
  if (body.slug) body.slug = slugifyRu(body.slug);
  if (body.characters !== undefined) {
    body.characters = await ensureCharacters(body.characters);
  }

  const derived = deriveSeoFields(body.name ?? product.name, body.shortDescription ?? product.shortDescription);
  body.seoTitle = derived.seoTitle;
  body.seoDescription = derived.seoDescription;

  Object.assign(product, body);
  await product.save();
  notifyRevalidate();
  res.json(product);
});

// DELETE /api/admin/products/:id  (admin)
export const deleteProduct = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) {
    res.status(404);
    throw new Error("Product not found");
  }
  await product.deleteOne();
  notifyRevalidate();
  res.json({ message: "Product deleted" });
});
