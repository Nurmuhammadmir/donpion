import asyncHandler from "express-async-handler";
import Product from "../models/Product.js";
import StockEntry from "../models/StockEntry.js";
import SiteSettings from "../models/SiteSettings.js";

// GET /api/warehouse/overview  (admin) — every product's current stock,
// lowest first, flagged against the admin's low-stock threshold (see
// SiteSettings.lowStockThreshold, editable on the Главная страница page).
export const getOverview = asyncHandler(async (req, res) => {
  const settings = await SiteSettings.findOne({ key: "homepage" });
  const threshold = settings?.lowStockThreshold ?? 5;

  const products = await Product.find({})
    .populate("category", "name")
    .select("name slug category stock isActive images")
    .sort({ stock: 1, name: 1 });

  res.json({
    threshold,
    items: products.map((p) => ({
      _id: p._id,
      name: p.name,
      slug: p.slug,
      category: p.category,
      stock: p.stock,
      isActive: p.isActive,
      image: p.images?.[0] || "",
      lowStock: p.stock <= threshold,
    })),
  });
});

// POST /api/warehouse/receipts  (admin) — "приход": new stock coming in.
export const createReceipt = asyncHandler(async (req, res) => {
  const { productId, quantity, note } = req.body;
  const qty = Number(quantity);
  if (!productId || !Number.isFinite(qty) || qty <= 0) {
    res.status(400);
    throw new Error("Укажите товар и положительное количество");
  }

  const product = await Product.findByIdAndUpdate(productId, { $inc: { stock: qty } }, { new: true });
  if (!product) {
    res.status(404);
    throw new Error("Товар не найден");
  }

  const entry = await StockEntry.create({ product: productId, quantity: qty, reason: "receipt", note: note || "" });
  res.status(201).json({ product, entry });
});

// POST /api/warehouse/adjustments  (admin) — manual correction after a
// recount, breakage, loss, etc. Quantity is signed; a note is required
// (unlike a receipt) since a correction always needs a reason on record.
// Never lets a correction push stock below zero — a physical count can't
// be negative, unlike a sale that oversold.
export const createAdjustment = asyncHandler(async (req, res) => {
  const { productId, quantity, note } = req.body;
  const qty = Number(quantity);
  if (!productId || !Number.isFinite(qty) || qty === 0) {
    res.status(400);
    throw new Error("Укажите товар и ненулевое количество");
  }
  if (!note || !String(note).trim()) {
    res.status(400);
    throw new Error("Укажите причину корректировки");
  }

  const product = await Product.findById(productId);
  if (!product) {
    res.status(404);
    throw new Error("Товар не найден");
  }
  product.stock = Math.max(0, product.stock + qty);
  await product.save();

  const entry = await StockEntry.create({ product: productId, quantity: qty, reason: "adjustment", note: note.trim() });
  res.status(201).json({ product, entry });
});

// GET /api/warehouse/entries  (admin) — movement history, newest first;
// optionally scoped to one product via ?product=<id>.
export const getEntries = asyncHandler(async (req, res) => {
  const { product, limit = 50 } = req.query;
  const filter = {};
  if (product) filter.product = product;

  const entries = await StockEntry.find(filter)
    .populate("product", "name slug")
    .sort({ createdAt: -1 })
    .limit(Number(limit));
  res.json(entries);
});
