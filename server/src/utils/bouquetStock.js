import Product from "../models/Product.js";
import Flower from "../models/Flower.js";
import StockEntry from "../models/StockEntry.js";
import { notifyRevalidate } from "./notifyRevalidate.js";

// Recomputes one bouquet's costPrice/category/stock/composition from its
// current recipe and the live state of its flowers. A no-op for addon
// products or any bouquet with no recipe yet (those keep their old,
// manually-set values untouched — only a product that actually has a
// recipe opts into this automatic behavior).
export async function recomputeBouquet(product) {
  if (product.kind !== "bouquet" || !product.recipe?.length) return product;

  const flowers = await Flower.find({ _id: { $in: product.recipe.map((l) => l.flower) } });
  const flowerById = new Map(flowers.map((f) => [String(f._id), f]));

  let costPrice = 0;
  let availability = Infinity;
  let dominant = null; // the recipe line with the largest quantity, for category

  // Largest quantity first — reads naturally as a "состав" list on the
  // storefront (what the bouquet is mostly made of, first).
  const sortedLines = [...product.recipe].sort((a, b) => b.quantity - a.quantity);
  const compositionLines = [];

  for (const line of sortedLines) {
    const flower = flowerById.get(String(line.flower));
    if (!flower) continue;
    costPrice += (flower.costPrice || 0) * line.quantity;
    availability = Math.min(availability, Math.floor((flower.stock || 0) / line.quantity));
    if (!dominant || line.quantity > dominant.quantity) dominant = { quantity: line.quantity, flower };
    compositionLines.push(`${line.quantity} шт. — ${flower.name}`);
  }

  product.costPrice = costPrice;
  product.stock = Number.isFinite(availability) ? Math.max(0, availability) : 0;
  if (dominant?.flower.category) product.category = dominant.flower.category;
  // The admin never types this by hand for a bouquet — it's always exactly
  // what the recipe says, so the storefront's "Состав" section can never
  // drift from what's actually in stock for it.
  product.composition = compositionLines;

  await product.save();
  // Every caller here (a flower edit, a batch import, a sale, a
  // cancellation) just changed what this bouquet's own price/stock/
  // composition look like live — without this, the storefront's ISR cache
  // wouldn't know until its normal window expires, same gap this already
  // closes for a direct product edit (see products.controller.js).
  notifyRevalidate();
  return product;
}

// Call after any Flower's stock or costPrice changes (a purchase batch, a
// sale, a manual adjustment) — every bouquet built from it needs its
// cached cost/availability brought back in sync.
export async function recomputeBouquetsUsingFlower(flowerId) {
  const products = await Product.find({ kind: "bouquet", "recipe.flower": flowerId });
  for (const product of products) {
    await recomputeBouquet(product);
  }
}

// A bouquet is never purchased/stocked directly — selling `quantity` of
// one instead consumes its recipe's flowers. Returns false (and does
// nothing) for an addon, or a bouquet with no recipe yet, so the caller
// falls back to the old direct Product.stock deduction for those.
export async function deductFlowersForSale(product, quantity, { order, branch } = {}) {
  if (product.kind !== "bouquet" || !product.recipe?.length) return false;

  const flowers = await Flower.find({ _id: { $in: product.recipe.map((l) => l.flower) } });
  const flowerById = new Map(flowers.map((f) => [String(f._id), f]));

  for (const line of product.recipe) {
    const flower = flowerById.get(String(line.flower));
    if (!flower) continue;
    const delta = line.quantity * quantity;
    flower.stock = Math.max(0, flower.stock - delta);
    await flower.save();
    await StockEntry.create({
      flower: flower._id,
      quantity: -delta,
      reason: "sale",
      order: order?._id,
      branch: branch ?? null,
      unitCost: flower.costPrice,
      note: order ? `Заказ ${order.orderNumber}` : "Продажа",
    });
  }
  for (const flower of flowerById.values()) await recomputeBouquetsUsingFlower(flower._id);
  return true;
}

// The cancellation-side mirror of deductFlowersForSale — same false/no-op
// contract for addons and recipe-less bouquets.
export async function restoreFlowersForCancel(product, quantity, { order, branch } = {}) {
  if (product.kind !== "bouquet" || !product.recipe?.length) return false;

  const flowers = await Flower.find({ _id: { $in: product.recipe.map((l) => l.flower) } });
  const flowerById = new Map(flowers.map((f) => [String(f._id), f]));

  for (const line of product.recipe) {
    const flower = flowerById.get(String(line.flower));
    if (!flower) continue;
    const delta = line.quantity * quantity;
    flower.stock += delta;
    await flower.save();
    await StockEntry.create({
      flower: flower._id,
      quantity: delta,
      reason: "cancel_restock",
      order: order?._id,
      branch: branch ?? null,
      note: order ? `Отмена заказа ${order.orderNumber}` : "Отмена",
    });
  }
  for (const flower of flowerById.values()) await recomputeBouquetsUsingFlower(flower._id);
  return true;
}
