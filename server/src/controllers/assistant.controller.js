import asyncHandler from "express-async-handler";
import Order from "../models/Order.js";
import Product from "../models/Product.js";
import Flower from "../models/Flower.js";
import SiteSettings from "../models/SiteSettings.js";
import { buildMarginReport } from "./finance.controller.js";

function todayKey() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// GET /api/assistant/morning-report  (assistant key only, read-only) —
// "заказы на сегодня, остатки склада, отчет маржи" in one call (ТЗ 3.4),
// built for the owner's daily Telegram digest rather than a general-
// purpose admin API.
export const getMorningReport = asyncHandler(async (req, res) => {
  const today = todayKey();
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // "На сегодня" = scheduled for today (deliveryDate), not merely placed
  // today — what actually needs to go out, which is what a morning digest
  // is for (an order placed just now, for delivery next week, isn't
  // today's work).
  const ordersToday = await Order.find({ deliveryDate: today, status: { $ne: "cancelled" } })
    .select("orderNumber customer.name customer.phone fulfillmentMethod deliveryTime status totalAmount items")
    .sort({ deliveryTime: 1 });

  const settings = await SiteSettings.findOne({ key: "homepage" }).select("lowStockThreshold");
  const threshold = settings?.lowStockThreshold ?? 5;

  const [lowFlowers, lowProducts, margin] = await Promise.all([
    Flower.find({ isActive: true, stock: { $lte: threshold } }).select("name stock unit").sort({ stock: 1 }),
    Product.find({ kind: "addon", isActive: true, stock: { $lte: threshold } }).select("name stock").sort({ stock: 1 }),
    buildMarginReport({ from: startOfToday, to: now, groupBy: "day" }),
  ]);

  res.json({
    date: today,
    ordersToday: ordersToday.map((o) => ({
      orderNumber: o.orderNumber,
      customerName: o.customer.name,
      customerPhone: o.customer.phone,
      fulfillmentMethod: o.fulfillmentMethod,
      deliveryTime: o.deliveryTime,
      status: o.status,
      totalAmount: o.totalAmount,
      items: o.items.map((i) => `${i.name} × ${i.quantity}`),
    })),
    ordersTodayCount: ordersToday.length,
    lowStock: {
      threshold,
      flowers: lowFlowers,
      products: lowProducts,
    },
    marginToday: margin.totals,
  });
});
