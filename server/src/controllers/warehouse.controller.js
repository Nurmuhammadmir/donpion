import asyncHandler from "express-async-handler";
import Product from "../models/Product.js";
import StockEntry from "../models/StockEntry.js";
import SiteSettings from "../models/SiteSettings.js";
import Supplier from "../models/Supplier.js";
import PurchaseBatch from "../models/PurchaseBatch.js";
import Branch from "../models/Branch.js";
import Flower from "../models/Flower.js";
import { recomputeBouquetsUsingFlower } from "../utils/bouquetStock.js";

// GET /api/warehouse/overview  (admin) — every product's current stock,
// lowest first, flagged against the admin's low-stock threshold (see
// SiteSettings.lowStockThreshold, editable on the Главная страница page).
// Also rolls up total inventory value at cost (stock × costPrice) so the
// Склад/Финансы pages can show how much money is sitting on the shelf.
export const getOverview = asyncHandler(async (req, res) => {
  const settings = await SiteSettings.findOne({ key: "homepage" });
  const threshold = settings?.lowStockThreshold ?? 5;

  // Addon-kind only — a bouquet has no stock of its own to receive or
  // correct here, its "Остаток" is only ever derived from the flowers in
  // its recipe (see utils/bouquetStock.js). Listing it here would make it
  // look like a directly-stocked item with a real Приход/Корректировка,
  // which it never is.
  const products = await Product.find({ kind: "addon" })
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
    .populate("items.flower", "name unit")
    .sort({ date: -1 })
    .limit(Number(limit));
  res.json(batches);
});

// POST /api/warehouse/batches  (admin) — records an incoming shipment of
// one or more individual flowers from a supplier: raises Flower.stock,
// rolls each line's cost into that flower's weighted-average costPrice,
// cascades into every bouquet built from it (recomputeBouquetsUsingFlower),
// and leaves one StockEntry per line (reason "receipt") pointing back at
// this batch — same ledger-per-change discipline as createReceipt below,
// just richer. This is the real "приход" — individual flowers, never
// finished bouquets; a bouquet's own stock is only ever derived from this.
export const createBatch = asyncHandler(async (req, res) => {
  const { branchId, supplierId, invoiceNumber, date, items, notes, additionalCost, additionalCostCurrency, additionalCostExchangeRate } = req.body;

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

  const flowers = await Flower.find({ _id: { $in: items.map((i) => i.flowerId) } });
  const flowerMap = new Map(flowers.map((f) => [String(f._id), f]));

  let totalCostUZS = 0;
  const cleanItems = [];
  for (const raw of items) {
    const flower = flowerMap.get(String(raw.flowerId));
    if (!flower) {
      res.status(400);
      throw new Error("Цветок не найден");
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
    cleanItems.push({ flower, quantity, unitCost, currency, exchangeRate, unitCostUZS });
  }

  // Landed-cost overhead for the whole shipment (freight, customs, broker
  // fees) — not any single line's own price, but still real cost of
  // getting these flowers onto the shelf. Allocated below by each line's
  // share of the batch's raw goods value, not split evenly per unit —
  // a $5 carnation and a $0.40 chrysanthemum shouldn't absorb the same
  // flat overhead per stem.
  const extraCurrency = additionalCostCurrency === "USD" ? "USD" : "UZS";
  const extraRate = extraCurrency === "USD" ? Math.max(0, Number(additionalCostExchangeRate) || 0) : 1;
  const additionalCostUZS = Math.max(0, Number(additionalCost) || 0) * extraRate;
  const rawGoodsTotal = totalCostUZS; // before overhead, used only for allocation below
  totalCostUZS += additionalCostUZS;

  const batch = await PurchaseBatch.create({
    branch: branch._id,
    supplier: supplierId || null,
    invoiceNumber: invoiceNumber || "",
    date: date || Date.now(),
    items: cleanItems.map(({ flower, quantity, unitCost, currency, exchangeRate }) => ({
      flower: flower._id,
      quantity,
      unitCost,
      currency,
      exchangeRate,
    })),
    additionalCost: Math.max(0, Number(additionalCost) || 0),
    additionalCostCurrency: extraCurrency,
    additionalCostExchangeRate: extraRate,
    totalCostUZS,
    notes: notes || "",
    createdBy: req.admin._id,
  });

  // One flower at a time (not a bulk update) since each line weighs its
  // new cost against that flower's own existing stock/cost, not a shared
  // average across the whole batch.
  for (const item of cleanItems) {
    const itemRawValue = item.quantity * item.unitCostUZS;
    const overheadShare = rawGoodsTotal > 0 ? (itemRawValue / rawGoodsTotal) * additionalCostUZS : 0;
    const landedUnitCostUZS = item.unitCostUZS + overheadShare / item.quantity;

    const existingQty = item.flower.stock;
    const existingCost = item.flower.costPrice || 0;
    const newQty = existingQty + item.quantity;
    const newCostPrice =
      newQty > 0 ? (existingQty * existingCost + item.quantity * landedUnitCostUZS) / newQty : landedUnitCostUZS;

    item.flower.stock = newQty;
    item.flower.costPrice = newCostPrice;
    await item.flower.save();

    await StockEntry.create({
      flower: item.flower._id,
      quantity: item.quantity,
      reason: "receipt",
      note: invoiceNumber ? `Партия ${invoiceNumber}` : "Приход партии",
      branch: branch._id,
      batch: batch._id,
      unitCost: landedUnitCostUZS,
    });

    await recomputeBouquetsUsingFlower(item.flower._id);
  }

  const populated = await PurchaseBatch.findById(batch._id)
    .populate("supplier", "name country")
    .populate("branch", "name")
    .populate("items.flower", "name unit");

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

  const existing = await Product.findById(productId).select("kind");
  if (!existing) {
    res.status(404);
    throw new Error("Товар не найден");
  }
  // A bouquet has no stock of its own — it's always derived from its
  // recipe's flowers. Receiving stock "on" one would just get silently
  // overwritten by the next recompute, so reject it outright instead of
  // pretending it did something.
  if (existing.kind === "bouquet") {
    res.status(400);
    throw new Error("У букета нет собственного остатка — приход оформляется на цветы в «Партиях»");
  }

  const product = await Product.findByIdAndUpdate(productId, { $inc: { stock: qty } }, { new: true });
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
  if (product.kind === "bouquet") {
    res.status(400);
    throw new Error("У букета нет собственного остатка — корректировка делается на цветы в «Партиях»");
  }
  product.stock = Math.max(0, product.stock + qty);
  await product.save();

  const entry = await StockEntry.create({ product: productId, quantity: qty, reason: "adjustment", note: note.trim() });
  res.status(201).json({ product, entry });
});

// GET /api/warehouse/entries  (admin) — movement history, newest first;
// optionally scoped to one product via ?product=<id>.
export const getEntries = asyncHandler(async (req, res) => {
  const { product, flower, limit = 50 } = req.query;
  const filter = {};
  if (product) filter.product = product;
  if (flower) filter.flower = flower;

  const entries = await StockEntry.find(filter)
    .populate("product", "name slug")
    .populate("flower", "name unit")
    .sort({ createdAt: -1 })
    .limit(Number(limit));
  res.json(entries);
});
