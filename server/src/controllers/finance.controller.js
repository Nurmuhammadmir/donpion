import asyncHandler from "express-async-handler";
import mongoose from "mongoose";
import Order from "../models/Order.js";
import StockEntry from "../models/StockEntry.js";
import Expense from "../models/Expense.js";
import Product from "../models/Product.js";
import { parseRange } from "../utils/dateRange.js";

// GET /api/finance/summary?branch=&from=&to=  (admin) — the P&L the
// Финансы tab is built around: revenue (paid-out orders) minus COGS (sale
// StockEntry lines × the cost price snapshot taken at sale time) minus
// logged expenses, for the chosen branch (omit for all branches combined)
// and date range (defaults to the last 30 days).
export const getFinanceSummary = asyncHandler(async (req, res) => {
  const { branch } = req.query;
  const { from, to } = parseRange(req.query);
  const branchFilter = branch ? { branch: new mongoose.Types.ObjectId(branch) } : {};

  const [revenueAgg, cogsAgg, expenseAgg, inventoryAgg] = await Promise.all([
    Order.aggregate([
      { $match: { ...branchFilter, createdAt: { $gte: from, $lte: to }, status: { $ne: "cancelled" } } },
      { $group: { _id: null, revenue: { $sum: "$totalAmount" }, orderCount: { $sum: 1 } } },
    ]),
    StockEntry.aggregate([
      {
        $match: {
          ...branchFilter,
          reason: "sale",
          createdAt: { $gte: from, $lte: to },
          unitCost: { $ne: null },
        },
      },
      { $group: { _id: null, cogs: { $sum: { $multiply: [{ $abs: "$quantity" }, "$unitCost"] } } } },
    ]),
    Expense.aggregate([
      { $match: { ...branchFilter, date: { $gte: from, $lte: to } } },
      { $group: { _id: "$category", total: { $sum: "$amount" } } },
    ]),
    Product.aggregate([
      { $match: { deletedAt: null } },
      { $group: { _id: null, value: { $sum: { $multiply: ["$stock", "$costPrice"] } } } },
    ]),
  ]);

  const revenue = revenueAgg[0]?.revenue ?? 0;
  const cogs = cogsAgg[0]?.cogs ?? 0;
  const expensesByCategory = {};
  let expensesTotal = 0;
  for (const row of expenseAgg) {
    expensesByCategory[row._id] = row.total;
    expensesTotal += row.total;
  }
  const grossProfit = revenue - cogs;
  const netProfit = grossProfit - expensesTotal;

  res.json({
    range: { from, to },
    revenue,
    orderCount: revenueAgg[0]?.orderCount ?? 0,
    cogs,
    grossProfit,
    expensesByCategory,
    expensesTotal,
    netProfit,
    inventoryValue: inventoryAgg[0]?.value ?? 0,
  });
});

function emptyMarginBucket() {
  return { revenue: 0, purchaseTotal: 0, assembly: 0, deliveryFee: 0, quantity: 0, orderCount: 0 };
}

function finalizeMarginBucket(bucket) {
  const cost = bucket.purchaseTotal + bucket.assembly + bucket.deliveryFee;
  const margin = bucket.revenue - cost;
  return { ...bucket, cost, margin, marginPercent: bucket.revenue > 0 ? (margin / bucket.revenue) * 100 : 0 };
}

function marginPeriodKey(date, groupBy) {
  const d = new Date(date);
  if (groupBy === "month") return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  if (groupBy === "week") {
    // Monday of that week, as a plain calendar date.
    const monday = new Date(d);
    const isoDay = (monday.getDay() + 6) % 7; // 0 = Monday ... 6 = Sunday
    monday.setDate(monday.getDate() - isoDay);
    return monday.toISOString().slice(0, 10);
  }
  return d.toISOString().slice(0, 10);
}

// Маржа в финансах (ТЗ 1.4) — revenue vs. the permanent per-item cost
// snapshot taken at sale time (Order.items[].costSnapshot), never
// recomputed from current product/flower data. Shared by the JSON report
// below and its CSV export, so they can never drift from each other.
export async function buildMarginReport({ branch, from, to, groupBy }) {
  const filter = { createdAt: { $gte: from, $lte: to }, status: { $ne: "cancelled" } };
  if (branch) filter.branch = branch;

  const orders = await Order.find(filter)
    .populate("branch", "name")
    .select("orderNumber createdAt totalAmount branch items")
    .sort({ createdAt: 1 })
    .lean();

  const totals = emptyMarginBucket();
  const byPeriodMap = new Map();
  const byProductMap = new Map();
  const byBranchMap = new Map();
  const perOrder = [];

  for (const order of orders) {
    const orderBucket = emptyMarginBucket();
    orderBucket.revenue = order.totalAmount;
    orderBucket.orderCount = 1;

    for (const item of order.items) {
      const snap = item.costSnapshot || { purchaseTotal: 0, assembly: 0, deliveryFee: 0 };
      orderBucket.purchaseTotal += snap.purchaseTotal;
      orderBucket.assembly += snap.assembly;
      orderBucket.deliveryFee += snap.deliveryFee;
      orderBucket.quantity += item.quantity;

      if (!byProductMap.has(item.name)) byProductMap.set(item.name, emptyMarginBucket());
      const productBucket = byProductMap.get(item.name);
      productBucket.revenue += item.price * item.quantity;
      productBucket.purchaseTotal += snap.purchaseTotal;
      productBucket.assembly += snap.assembly;
      productBucket.deliveryFee += snap.deliveryFee;
      productBucket.quantity += item.quantity;
      productBucket.orderCount += 1;
    }

    const period = marginPeriodKey(order.createdAt, groupBy);
    if (!byPeriodMap.has(period)) byPeriodMap.set(period, emptyMarginBucket());
    const branchName = order.branch?.name ?? "Без филиала";
    if (!byBranchMap.has(branchName)) byBranchMap.set(branchName, emptyMarginBucket());

    for (const bucket of [totals, byPeriodMap.get(period), byBranchMap.get(branchName)]) {
      bucket.revenue += orderBucket.revenue;
      bucket.purchaseTotal += orderBucket.purchaseTotal;
      bucket.assembly += orderBucket.assembly;
      bucket.deliveryFee += orderBucket.deliveryFee;
      bucket.quantity += orderBucket.quantity;
      bucket.orderCount += 1;
    }

    perOrder.push({
      _id: order._id,
      orderNumber: order.orderNumber,
      createdAt: order.createdAt,
      branch: branchName,
      ...finalizeMarginBucket(orderBucket),
    });
  }

  return {
    totals: finalizeMarginBucket(totals),
    perOrder,
    byPeriod: [...byPeriodMap.entries()]
      .map(([period, bucket]) => ({ period, ...finalizeMarginBucket(bucket) }))
      .sort((a, b) => a.period.localeCompare(b.period)),
    byProduct: [...byProductMap.entries()]
      .map(([name, bucket]) => ({ name, ...finalizeMarginBucket(bucket) }))
      .sort((a, b) => b.revenue - a.revenue),
    byBranch: [...byBranchMap.entries()]
      .map(([name, bucket]) => ({ name, ...finalizeMarginBucket(bucket) }))
      .sort((a, b) => b.revenue - a.revenue),
  };
}

// GET /api/finance/margin-report?branch=&from=&to=&groupBy=day|week|month  (admin)
export const getMarginReport = asyncHandler(async (req, res) => {
  const { branch, groupBy = "day" } = req.query;
  const { from, to } = parseRange(req.query);
  const report = await buildMarginReport({ branch, from, to, groupBy });
  res.json({ range: { from, to }, groupBy, ...report });
});

function csvEscape(value) {
  const str = String(value ?? "");
  return /[",\n;]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

function csvRow(values) {
  return values.map(csvEscape).join(";");
}

// GET /api/finance/margin-report/export?branch=&from=&to=&groupBy=  (admin)
// CSV, not a .xlsx binary — Excel opens it natively with no extra library
// on either end, same practical result as "Выгрузка в Excel" (ТЗ 1.4).
export const exportMarginReport = asyncHandler(async (req, res) => {
  const { branch, groupBy = "day" } = req.query;
  const { from, to } = parseRange(req.query);
  const report = await buildMarginReport({ branch, from, to, groupBy });

  const lines = [];
  lines.push(csvRow(["Заказ", "Дата", "Филиал", "Выручка", "Закупка", "Сборка", "Доставка", "Маржа", "Маржа %"]));
  for (const o of report.perOrder) {
    lines.push(
      csvRow([
        o.orderNumber,
        new Date(o.createdAt).toLocaleString("ru-RU"),
        o.branch,
        o.revenue,
        o.purchaseTotal,
        o.assembly,
        o.deliveryFee,
        Math.round(o.margin),
        o.marginPercent.toFixed(1),
      ])
    );
  }
  lines.push([]);
  lines.push(csvRow(["ИТОГО", "", "", report.totals.revenue, report.totals.purchaseTotal, report.totals.assembly, report.totals.deliveryFee, Math.round(report.totals.margin), report.totals.marginPercent.toFixed(1)]));

  lines.push([]);
  lines.push(csvRow(["По букетам", "Кол-во", "Выручка", "Закупка", "Сборка", "Доставка", "Маржа", "Маржа %"]));
  for (const p of report.byProduct) {
    lines.push(csvRow([p.name, p.quantity, p.revenue, p.purchaseTotal, p.assembly, p.deliveryFee, Math.round(p.margin), p.marginPercent.toFixed(1)]));
  }

  lines.push([]);
  lines.push(csvRow(["По филиалам", "Заказов", "Выручка", "Закупка", "Сборка", "Доставка", "Маржа", "Маржа %"]));
  for (const b of report.byBranch) {
    lines.push(csvRow([b.name, b.orderCount, b.revenue, b.purchaseTotal, b.assembly, b.deliveryFee, Math.round(b.margin), b.marginPercent.toFixed(1)]));
  }

  // BOM so Excel detects UTF-8 (otherwise Cyrillic text shows as mojibake).
  const csv = "﻿" + lines.join("\n");
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="marzha-${from.toISOString().slice(0, 10)}-${to.toISOString().slice(0, 10)}.csv"`);
  res.send(csv);
});

// GET /api/finance/expenses?branch=&category=&from=&to=&page=&limit=  (admin)
export const getExpenses = asyncHandler(async (req, res) => {
  const { branch, category, page = 1, limit = 30 } = req.query;
  const filter = {};
  if (branch) filter.branch = branch;
  if (category) filter.category = category;
  if (req.query.from || req.query.to) {
    const { from, to } = parseRange(req.query);
    filter.date = { $gte: from, $lte: to };
  }

  const skip = (Number(page) - 1) * Number(limit);
  const [items, total] = await Promise.all([
    Expense.find(filter).populate("branch", "name").sort({ date: -1 }).skip(skip).limit(Number(limit)),
    Expense.countDocuments(filter),
  ]);
  res.json({ items, total, page: Number(page), pages: Math.ceil(total / Number(limit)) });
});

// POST /api/finance/expenses  (admin)
export const createExpense = asyncHandler(async (req, res) => {
  const { branch, category, amount, date, description, isRecurring } = req.body;
  if (!branch || !category || !Number.isFinite(Number(amount)) || Number(amount) <= 0) {
    res.status(400);
    throw new Error("Укажите филиал, категорию и сумму расхода");
  }
  const expense = await Expense.create({
    branch,
    category,
    amount: Number(amount),
    date: date || Date.now(),
    description: description || "",
    isRecurring: Boolean(isRecurring),
    createdBy: req.admin._id,
  });
  res.status(201).json(expense);
});

// PUT /api/finance/expenses/:id  (admin)
export const updateExpense = asyncHandler(async (req, res) => {
  const expense = await Expense.findById(req.params.id);
  if (!expense) {
    res.status(404);
    throw new Error("Расход не найден");
  }
  Object.assign(expense, req.body);
  await expense.save();
  res.json(expense);
});

// DELETE /api/finance/expenses/:id  (admin)
export const deleteExpense = asyncHandler(async (req, res) => {
  const expense = await Expense.findById(req.params.id);
  if (!expense) {
    res.status(404);
    throw new Error("Расход не найден");
  }
  await expense.deleteOne();
  res.json({ message: "Expense deleted" });
});
