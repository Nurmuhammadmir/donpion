import asyncHandler from "express-async-handler";
import Product from "../models/Product.js";
import Category from "../models/Category.js";
import Character from "../models/Character.js";
import AddonCategory from "../models/AddonCategory.js";
import Occasion from "../models/Occasion.js";
import { slugifyRu } from "../utils/slugify.js";
import { notifyRevalidate } from "../utils/notifyRevalidate.js";
import { recomputeBouquet } from "../utils/bouquetStock.js";
import { computeRecommendedPrice } from "../utils/bouquetPricing.js";
import { RECIPIENTS, COLORS } from "../constants/catalogFilters.js";

// Every product tags every active Character — the admin never picks this
// (there's nothing to decide: it's not "which personality does this suit",
// it's "make sure this shows up in all the homepage quiz's results").
async function allCharacterIds() {
  const activeCharacters = await Character.find({ isActive: true }).select("_id");
  return activeCharacters.map((c) => c._id);
}

// Category is required at the schema level (every product page, breadcrumb
// and catalog filter assumes one exists) but the admin shouldn't be forced
// to pick one before they can even save a draft — a product left
// uncategorized falls back to a shared "Разное" category (created once,
// reused after) instead of blocking the save.
async function ensureCategory(categoryId) {
  if (categoryId) return categoryId;

  let fallback = await Category.findOne({ slug: "raznoe" });
  if (!fallback) {
    fallback = await Category.create({
      name: "Разное",
      slug: "raznoe",
      shortDescription: "Товары и подарочные наборы, которые не относятся к отдельному виду цветов.",
      introText:
        "Здесь — то, что не сводится к одному виду цветов: сборные подарочные наборы, сертификаты и особые позиции.",
      seoTitle: "Разное — купить с доставкой в Ташкенте | DonPion",
      seoDescription: "Разные товары и подарочные наборы с доставкой по Ташкенту в день заказа.",
      image: "https://images.unsplash.com/photo-1519378058457-4c29a0a2efac?auto=format&fit=crop&w=1200&q=80",
      sortOrder: 999,
      isActive: true,
    });
  }
  return fallback._id;
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

// Comma-separated list of enum values (ТЗ 3.1 — "кому"/цвет checkboxes
// can select more than one), kept to the known fixed list so this can't
// become a free-form query injection vector.
function asEnumList(value, allowed) {
  const str = asQueryString(value);
  if (!str) return undefined;
  const values = str.split(",").filter((v) => allowed.includes(v));
  return values.length > 0 ? values : undefined;
}

// GET /api/products?category=rozy&character=..&addonCategory=..&occasion=..&recipient=..&color=..&priceMin=&priceMax=&search=..&featured=true&page=1&limit=24
export const getProducts = asyncHandler(async (req, res) => {
  const { page = 1, limit = 24 } = req.query;
  const category = asQueryString(req.query.category);
  const character = asQueryString(req.query.character);
  const addonCategory = asQueryString(req.query.addonCategory);
  const occasion = asQueryString(req.query.occasion);
  const recipients = asEnumList(req.query.recipient, RECIPIENTS);
  const colors = asEnumList(req.query.color, COLORS);
  const priceMin = Number(req.query.priceMin);
  const priceMax = Number(req.query.priceMax);
  const search = asQueryString(req.query.search);
  const featured = asQueryString(req.query.featured);

  // priceConfirmed: a brand-new bouquet with no price ever confirmed yet
  // stays unlisted here (ТЗ 1.2: "новый букет не публикуется") — existing
  // products default to true so none of them are affected by this.
  const filter = { isActive: true, priceConfirmed: true };

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

  if (addonCategory) {
    const addon = await AddonCategory.findOne({ slug: addonCategory });
    if (!addon) return res.json({ items: [], total: 0, page: Number(page), pages: 0 });
    filter.addonCategories = addon._id;
  }

  if (occasion) {
    const occ = await Occasion.findOne({ slug: occasion });
    if (!occ) return res.json({ items: [], total: 0, page: Number(page), pages: 0 });
    filter.occasions = occ._id;
  }

  if (recipients) filter.recipients = { $in: recipients };
  if (colors) filter.colors = { $in: colors };
  if (Number.isFinite(priceMin) || Number.isFinite(priceMax)) {
    filter.price = {};
    if (Number.isFinite(priceMin)) filter.price.$gte = priceMin;
    if (Number.isFinite(priceMax)) filter.price.$lte = priceMax;
  }

  if (featured === "true") filter.isFeatured = true;
  if (search) filter.$text = { $search: search };

  const skip = (Number(page) - 1) * Number(limit);

  const [items, total] = await Promise.all([
    Product.find(filter)
      .populate("category", "name slug")
      .populate("characters", "name slug")
      // Cheapest first by default — a newest-first catalog kept pushing a
      // random expensive bouquet to the top of every section regardless of
      // price, which read as arbitrary to customers browsing by budget.
      .sort({ price: 1 })
      // costPrice/recipe/pricing-formula inputs are internal — how much we
      // paid, exactly which flowers a bouquet is built from, and the
      // margin math behind its price — never for a public response (ТЗ 1.2).
      .select("-costPrice -recipe -packagingCost -ribbonCost -assemblyPercent -markupMultiplier -deliveryFee -priceConfirmed -priceHistory")
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
  const product = await Product.findOne({ slug: req.params.slug, isActive: true, priceConfirmed: true })
    .populate("category", "name slug")
    .populate("addonCategories", "name slug")
    .select("-costPrice -recipe -packagingCost -ribbonCost -assemblyPercent -markupMultiplier -deliveryFee -priceConfirmed -priceHistory");
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
    .populate("characters", "name slug")
    .populate("addonCategories", "name slug")
    .populate("occasions", "name slug");
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
  const hasRecipe = Array.isArray(body.recipe) && body.recipe.length > 0;
  // A bouquet with a recipe gets its real category from recomputeBouquet
  // right after save (the dominant flower's own category) — ensureCategory
  // here is just a placeholder so the required field never blocks the
  // insert; it's immediately overwritten below.
  const category = await ensureCategory(body.category);
  const characters = await allCharacterIds();
  const { seoTitle, seoDescription } = deriveSeoFields(body.name, body.shortDescription);
  // Nothing to curate here — every bouquet belongs in "Люксовые коллекции"
  // on the homepage; addons keep whatever the admin actually set.
  const isFeatured = body.kind === "addon" ? Boolean(body.isFeatured) : true;

  let product = await Product.create({
    ...body,
    slug,
    category,
    characters,
    seoTitle,
    seoDescription,
    // Long story text is independent copy — default it to the short
    // description only when the admin hasn't written one yet, instead of
    // always mirroring shortDescription (that used to erase a real story).
    story: body.story && body.story.trim() ? body.story : body.shortDescription,
    isFeatured,
    // A brand-new bouquet has no price confirmed yet — stays unpublished
    // (see the public-endpoint filters below) until the admin explicitly
    // confirms one via confirmPrice. Doesn't apply to an addon at all — it
    // has no pricing-formula/confirm UI, so gating it the same way would
    // leave it permanently unpublishable with no way to ever confirm it.
    priceConfirmed: body.kind !== "bouquet",
  });
  if (hasRecipe) product = await recomputeBouquet(product);

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
  body.characters = await allCharacterIds();
  if (body.category !== undefined && !(Array.isArray(body.recipe) && body.recipe.length > 0)) {
    body.category = await ensureCategory(body.category);
  }
  const kind = body.kind ?? product.kind;
  if (kind !== "addon") body.isFeatured = true;

  const derived = deriveSeoFields(body.name ?? product.name, body.shortDescription ?? product.shortDescription);
  body.seoTitle = derived.seoTitle;
  body.seoDescription = derived.seoDescription;
  // Long story text is independent of shortDescription — only touch it when
  // the admin actually submitted one, and fall back to shortDescription
  // only if they left it blank (not on every unrelated save).
  if (body.story !== undefined) {
    body.story = body.story.trim() ? body.story : body.shortDescription ?? product.shortDescription;
  }

  Object.assign(product, body);
  await product.save();
  await recomputeBouquet(product);
  notifyRevalidate();
  res.json(product);
});

// POST /api/admin/products/:id/confirm-price  (admin) — the only place
// `price` (the one customers see) actually changes once a bouquet has been
// created. Also applies the pricing-input fields (packaging/ribbon/the
// three overrides) from the same request, so confirming always acts on
// exactly what's in the form rather than requiring a separate save first.
// body: { mode: "recommended" | "custom", price?, packagingCost?,
// ribbonCost?, assemblyPercent?, markupMultiplier?, deliveryFee? }.
export const confirmPrice = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) {
    res.status(404);
    throw new Error("Product not found");
  }

  const { packagingCost, ribbonCost, assemblyPercent, markupMultiplier, deliveryFee } = req.body;
  if (packagingCost !== undefined) product.packagingCost = Math.max(0, Number(packagingCost) || 0);
  if (ribbonCost !== undefined) product.ribbonCost = Math.max(0, Number(ribbonCost) || 0);
  product.assemblyPercent = assemblyPercent === "" || assemblyPercent === undefined || assemblyPercent === null ? null : Number(assemblyPercent);
  product.markupMultiplier =
    markupMultiplier === "" || markupMultiplier === undefined || markupMultiplier === null ? null : Number(markupMultiplier);
  product.deliveryFee = deliveryFee === "" || deliveryFee === undefined || deliveryFee === null ? null : Number(deliveryFee);

  const { recommendedPrice } = await computeRecommendedPrice(product);

  let finalPrice;
  if (req.body.mode === "custom") {
    finalPrice = Number(req.body.price);
    if (!Number.isFinite(finalPrice) || finalPrice < 0) {
      res.status(400);
      throw new Error("Укажите корректную цену");
    }
  } else {
    finalPrice = recommendedPrice;
  }

  const diffPercent = recommendedPrice > 0 ? ((finalPrice - recommendedPrice) / recommendedPrice) * 100 : 0;

  product.price = finalPrice;
  product.priceConfirmed = true;
  product.priceHistory.push({
    at: new Date(),
    by: req.admin._id,
    recommendedPrice,
    finalPrice,
    diffPercent,
  });
  await product.save();
  notifyRevalidate();

  const populated = await Product.findById(product._id).populate("priceHistory.by", "name");
  res.json(populated);
});

// DELETE /api/admin/products/:id  (admin) — soft delete: flips deletedAt
// rather than actually removing the document, so a product never just
// vanishes with no way back (see Product.js's exclude-by-default hook).
export const deleteProduct = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) {
    res.status(404);
    throw new Error("Product not found");
  }
  product.deletedAt = new Date();
  await product.save();
  notifyRevalidate();
  res.json({ message: "Product deleted" });
});
