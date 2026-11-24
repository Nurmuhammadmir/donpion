import asyncHandler from "express-async-handler";
import mongoose from "mongoose";
import Order from "../models/Order.js";
import StockEntry from "../models/StockEntry.js";
import Expense from "../models/Expense.js";
import Product from "../models/Product.js";
import Branch from "../models/Branch.js";
import SiteSettings from "../models/SiteSettings.js";
import CashMovement from "../models/CashMovement.js";
import { parseRange } from "../utils/dateRange.js";
import { applyExpense, reverseExpense, transferCashToBank, adjustBalance } from "../utils/cashBalance.js";

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
  const { branch, category, amount, date, description, isRecurring, paymentSource } = req.body;
  if (!branch || !category || !Number.isFinite(Number(amount)) || Number(amount) <= 0) {
    res.status(400);
    throw new Error("Укажите филиал, категорию и сумму расхода");
  }
  const expense = await Expense.create({
    branch,
    category,
    amount: Number(amount),
    paymentSource: paymentSource === "bank" ? "bank" : "cash",
    date: date || Date.now(),
    description: description || "",
    isRecurring: Boolean(isRecurring),
    createdBy: req.admin._id,
  });
  await applyExpense(expense);
  res.status(201).json(expense);
});

// PUT /api/finance/expenses/:id  (admin)
export const updateExpense = asyncHandler(async (req, res) => {
  const expense = await Expense.findById(req.params.id);
  if (!expense) {
    res.status(404);
    throw new Error("Расход не найден");
  }
  const before = expense.toObject();
  Object.assign(expense, req.body);
  await expense.save();
  // Reverse the old amount/bucket, then apply the new one — simplest way
  // to stay correct no matter which fields actually changed.
  await reverseExpense(before);
  await applyExpense(expense);
  res.json(expense);
});

// DELETE /api/finance/expenses/:id  (admin)
export const deleteExpense = asyncHandler(async (req, res) => {
  const expense = await Expense.findById(req.params.id);
  if (!expense) {
    res.status(404);
    throw new Error("Расход не найден");
  }
  await reverseExpense(expense, "Расход удалён");
  await expense.deleteOne();
  res.json({ message: "Expense deleted" });
});

// GET /api/finance/balance  (admin) — "Касса/Баланс": реальный остаток —
// сколько наличных в кассе каждого филиала + один общий безналичный счёт
// фирмы (карта + онлайн). A branch-pinned admin (not CEO) only ever sees
// their own till, never other branches' cash or the company-wide bank
// balance — same scoping BranchContext already enforces on the frontend,
// just also enforced here so hitting the API directly can't bypass it.
export const getBalance = asyncHandler(async (req, res) => {
  const isCEO = req.admin.role === "superadmin";
  const branchFilter = isCEO ? {} : { _id: req.admin.branch };
  const [branches, settings] = await Promise.all([
    Branch.find(branchFilter).select("name isActive cashBalance").sort({ isMain: -1, name: 1 }),
    isCEO ? SiteSettings.findOne({ key: "homepage" }).select("bankBalance") : null,
  ]);
  res.json({
    branches,
    bankBalance: isCEO ? settings?.bankBalance ?? 0 : null,
    totalCash: branches.reduce((sum, b) => sum + b.cashBalance, 0),
  });
});

// GET /api/finance/balance/movements?bucket=&branch=&page=&limit=  (admin)
export const getBalanceMovements = asyncHandler(async (req, res) => {
  const { page = 1, limit = 30 } = req.query;
  const isCEO = req.admin.role === "superadmin";
  const filter = {};
  if (isCEO) {
    if (req.query.bucket === "cash" || req.query.bucket === "bank") filter.bucket = req.query.bucket;
    if (req.query.branch) filter.branch = req.query.branch;
  } else {
    // Same reasoning as getBalance above — never bank-bucket, never another branch's till.
    filter.bucket = "cash";
    filter.branch = req.admin.branch;
  }

  const skip = (Number(page) - 1) * Number(limit);
  const [items, total] = await Promise.all([
    CashMovement.find(filter)
      .populate("branch", "name")
      .populate("order", "orderNumber")
      .populate("expense", "category description")
      .populate("createdBy", "name")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit)),
    CashMovement.countDocuments(filter),
  ]);
  res.json({ items, total, page: Number(page), pages: Math.ceil(total / Number(limit)) });
});

// POST /api/finance/balance/transfer  (admin) — "сдать наличку в банк". A
// branch-pinned admin may only deposit their own till; the deposit still
// lands in the one shared bank balance either way.
export const transferBalance = asyncHandler(async (req, res) => {
  const { branchId, amount, note } = req.body;
  const isCEO = req.admin.role === "superadmin";
  if (!branchId || !Number.isFinite(Number(amount)) || Number(amount) <= 0) {
    res.status(400);
    throw new Error("Укажите филиал и сумму перевода");
  }
  if (!isCEO && String(branchId) !== String(req.admin.branch)) {
    res.status(403);
    throw new Error("Можно сдавать наличку только из своего филиала");
  }
  res.status(400); // in case transferCashToBank rejects it below (e.g. insufficient cash) — a client mistake, not a server fault
  await transferCashToBank({ branchId, amount: Number(amount), note: note || "", adminId: req.admin._id });
  res.status(200).json({ message: "Перевод выполнен" });
});

// POST /api/finance/balance/adjust  (admin) — ручная коррекция/стартовый
// остаток. A branch-pinned admin may only correct their own till's cash,
// never the shared company bank balance — that's CEO-only.
export const adjustBalanceEntry = asyncHandler(async (req, res) => {
  const { bucket, branchId, targetAmount, note } = req.body;
  const isCEO = req.admin.role === "superadmin";
  if (bucket !== "cash" && bucket !== "bank") {
    res.status(400);
    throw new Error("Некорректный тип баланса");
  }
  if (bucket === "cash" && !branchId) {
    res.status(400);
    throw new Error("Укажите филиал");
  }
  if (!Number.isFinite(Number(targetAmount))) {
    res.status(400);
    throw new Error("Укажите сумму");
  }
  if (!isCEO && (bucket === "bank" || String(branchId) !== String(req.admin.branch))) {
    res.status(403);
    throw new Error("Можно поправить только остаток своего филиала");
  }
  res.status(400);
  await adjustBalance({ bucket, branchId, targetAmount: Number(targetAmount), note: note || "", adminId: req.admin._id });
  res.status(200).json({ message: "Баланс обновлён" });
});
