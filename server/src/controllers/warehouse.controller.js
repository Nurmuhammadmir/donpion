import asyncHandler from "express-async-handler";
import Product from "../models/Product.js";
import StockEntry from "../models/StockEntry.js";
import SiteSettings from "../models/SiteSettings.js";
import Supplier from "../models/Supplier.js";
import PurchaseBatch from "../models/PurchaseBatch.js";
import Branch from "../models/Branch.js";

// GET /api/warehouse/overview  (admin) — every product's current stock,
// lowest first, flagged against the admin's low-stock threshold (see
// SiteSettings.lowStockThreshold, editable on the Главная страница page).
// Also rolls up total inventory value at cost (stock × costPrice) so the
// Склад/Финансы pages can show how much money is sitting on the shelf.
export const getOverview = asyncHandler(async (req, res) => {
  const settings = await SiteSettings.findOne({ key: "homepage" });
  const threshold = settings?.lowStockThreshold ?? 5;

  const products = await Product.find({})
    .populate("category", "name")
    .select("name slug category stock isActive images costPrice")
    .sort({ stock: 1, name: 1 });

  const totalValue = products.reduce((sum, p) => sum + p.stock * (p.costPrice || 0), 0);

  res.json({
    threshold,
    totalValue,
    items: products.map((p) => ({
      _id: p._id,
      name: p.name,
      slug: p.slug,
      category: p.category,
      stock: p.stock,
      costPrice: p.costPrice || 0,
      isActive: p.isActive,
      image: p.images?.[0] || "",
      lowStock: p.stock <= threshold,
    })),
  });
});

// ---- Suppliers --------------------------------------------------------

// GET /api/warehouse/suppliers  (admin)
export const getSuppliers = asyncHandler(async (req, res) => {
  const suppliers = await Supplier.find({}).sort({ name: 1 });
  res.json(suppliers);
});

// POST /api/warehouse/suppliers  (admin)
export const createSupplier = asyncHandler(async (req, res) => {
  const supplier = await Supplier.create(req.body);
  res.status(201).json(supplier);
});

// PUT /api/warehouse/suppliers/:id  (admin)
export const updateSupplier = asyncHandler(async (req, res) => {
  const supplier = await Supplier.findById(req.params.id);
  if (!supplier) {
    res.status(404);
    throw new Error("Поставщик не найден");
  }
  Object.assign(supplier, req.body);
  await supplier.save();
  res.json(supplier);
});

// DELETE /api/warehouse/suppliers/:id  (admin)
export const deleteSupplier = asyncHandler(async (req, res) => {
  const supplier = await Supplier.findById(req.params.id);
  if (!supplier) {
    res.status(404);
    throw new Error("Поставщик не найден");
  }
  await supplier.deleteOne();
  res.json({ message: "Supplier deleted" });
});

// ---- Purchase batches ("приход партии") --------------------------------

// GET /api/warehouse/batches?branch=&limit=  (admin)
export const getBatches = asyncHandler(async (req, res) => {
  const { branch, limit = 50 } = req.query;
  const filter = {};
  if (branch) filter.branch = branch;

  const batches = await PurchaseBatch.find(filter)
    .populate("supplier", "name country")
    .populate("branch", "name")
    .populate("items.product", "name slug images")
    .sort({ date: -1 })
    .limit(Number(limit));
  res.json(batches);
});

// POST /api/warehouse/batches  (admin) — records an incoming shipment of
// one or more products from a supplier: raises Product.stock, rolls each
// line's cost into that product's weighted-average costPrice, and leaves
// one StockEntry per line (reason "receipt") pointing back at this batch —
// same ledger-per-change discipline as createReceipt below, just richer.
export const createBatch = asyncHandler(async (req, res) => {
  const { branchId, supplierId, invoiceNumber, date, items, notes } = req.body;

  if (!branchId) {
    res.status(400);
    throw new Error("Укажите филиал");
  }
  if (!Array.isArray(items) || items.length === 0) {
    res.status(400);
    throw new Error("Добавьте хотя бы одну позицию в партию");
  }

  const branch = await Branch.findById(branchId);
  if (!branch) {
    res.status(404);
    throw new Error("Филиал не найден");
  }

  const products = await Product.find({ _id: { $in: items.map((i) => i.productId) } });
  const productMap = new Map(products.map((p) => [String(p._id), p]));

  let totalCostUZS = 0;
  const cleanItems = [];
  for (const raw of items) {
    const product = productMap.get(String(raw.productId));
    if (!product) {
      res.status(400);
      throw new Error("Товар не найден");
    }
    const quantity = Math.max(1, Math.trunc(Number(raw.quantity) || 0));
    const unitCost = Math.max(0, Number(raw.unitCost) || 0);
    const currency = raw.currency === "USD" ? "USD" : "UZS";
    const exchangeRate = currency === "USD" ? Math.max(0, Number(raw.exchangeRate) || 0) : 1;
    if (!quantity || (currency === "USD" && !exchangeRate)) {
      res.status(400);
      throw new Error("Укажите количество и курс для позиций в валюте");
    }
    const unitCostUZS = unitCost * exchangeRate;
    totalCostUZS += unitCostUZS * quantity;
    cleanItems.push({ product, quantity, unitCost, currency, exchangeRate, unitCostUZS });
  }

  const batch = await PurchaseBatch.create({
    branch: branch._id,
    supplier: supplierId || null,
    invoiceNumber: invoiceNumber || "",
    date: date || Date.now(),
    items: cleanItems.map(({ product, quantity, unitCost, currency, exchangeRate }) => ({
      product: product._id,
      quantity,
      unitCost,
      currency,
      exchangeRate,
    })),
    totalCostUZS,
    notes: notes || "",
    createdBy: req.admin._id,
  });

  // One product at a time (not a bulk update) since each line weighs its
  // new cost against that product's own existing stock/cost, not a shared
  // average across the whole batch.
  for (const item of cleanItems) {
    const existingQty = item.product.stock;
    const existingCost = item.product.costPrice || 0;
    const newQty = existingQty + item.quantity;
    const newCostPrice =
      newQty > 0 ? (existingQty * existingCost + item.quantity * item.unitCostUZS) / newQty : item.unitCostUZS;

    item.product.stock = newQty;
    item.product.costPrice = newCostPrice;
    await item.product.save();

    await StockEntry.create({
      product: item.product._id,
      quantity: item.quantity,
      reason: "receipt",
      note: invoiceNumber ? `Партия ${invoiceNumber}` : "Приход партии",
      branch: branch._id,
      batch: batch._id,
      unitCost: item.unitCostUZS,
    });
  }

  const populated = await PurchaseBatch.findById(batch._id)
    .populate("supplier", "name country")
    .populate("branch", "name")
    .populate("items.product", "name slug images");

  res.status(201).json(populated);
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
