import asyncHandler from "express-async-handler";
import mongoose from "mongoose";
import Order from "../models/Order.js";
import StockEntry from "../models/StockEntry.js";
import Expense from "../models/Expense.js";
import Product from "../models/Product.js";

// "2026-11-10" is a plain calendar date, not an instant — parsed as
// `new Date(str)` it's midnight UTC, which (a) excludes that entire day
// from an inclusive upper bound, since anything after 00:00 UTC on the
// last day would be cut off, and (b) silently shifts whole-day meaning
// for a non-UTC server/business like this one (Tashkent, UTC+5). Parsed
// locally and pinned to day-start/day-end instead, matching the "local
// calendar day" the client (and getOrderStats elsewhere) already means.
function parseLocalDate(str, endOfDay) {
  const [y, m, d] = str.split("-").map(Number);
  return endOfDay ? new Date(y, m - 1, d, 23, 59, 59, 999) : new Date(y, m - 1, d, 0, 0, 0, 0);
}

function parseRange(query) {
  const to = query.to ? parseLocalDate(query.to, true) : new Date();
  const from = query.from ? parseLocalDate(query.from, false) : new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);
  return { from, to };
}

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
    Product.aggregate([{ $group: { _id: null, value: { $sum: { $multiply: ["$stock", "$costPrice"] } } } }]),
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
