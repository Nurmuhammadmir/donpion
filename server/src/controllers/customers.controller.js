import asyncHandler from "express-async-handler";
import Customer from "../models/Customer.js";
import Order from "../models/Order.js";

// GET /api/customers?search=&page=&limit=  (admin) — "Клиенты" (ТЗ 2.3).
// Search matches name or phone, case-insensitive substring.
export const getCustomers = asyncHandler(async (req, res) => {
  const { search, page = 1, limit = 30 } = req.query;
  const filter = {};
  if (search) {
    const regex = new RegExp(String(search).trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    filter.$or = [{ name: regex }, { phone: regex }];
  }

  const skip = (Number(page) - 1) * Number(limit);
  const [items, total] = await Promise.all([
    Customer.find(filter).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)),
    Customer.countDocuments(filter),
  ]);
  res.json({ items, total, page: Number(page), pages: Math.ceil(total / Number(limit)) });
});

// GET /api/customers/:id  (admin) — карточка клиента: order history and
// total spend computed fresh (not denormalized onto Customer), same
// reasoning as the rest of this codebase prefers a live aggregate over a
// cached counter that can drift.
export const getCustomerById = asyncHandler(async (req, res) => {
  const customer = await Customer.findById(req.params.id);
  if (!customer) {
    res.status(404);
    throw new Error("Клиент не найден");
  }

  const orders = await Order.find({ customerId: customer._id }).sort({ createdAt: -1 }).select("orderNumber createdAt status totalAmount items");
  const totalSpent = orders.filter((o) => o.status !== "cancelled").reduce((sum, o) => sum + o.totalAmount, 0);

  res.json({ customer, orders, totalSpent });
});

// PUT /api/customers/:id  (admin) — name + important dates only; phone
// stays read-only here, it's the login identity (see authCustomer).
export const updateCustomer = asyncHandler(async (req, res) => {
  const customer = await Customer.findById(req.params.id);
  if (!customer) {
    res.status(404);
    throw new Error("Клиент не найден");
  }
  const { name, importantDates } = req.body;
  if (name !== undefined) customer.name = name;
  if (importantDates !== undefined) {
    for (const entry of importantDates) {
      if (!/^\d{2}-\d{2}$/.test(entry.date)) {
        res.status(400);
        throw new Error(`Некорректная дата «${entry.date}» — формат ММ-ДД`);
      }
    }
    customer.importantDates = importantDates;
  }
  await customer.save();
  res.json(customer);
});

// How many days from `from` until the next occurrence of "MM-DD",
// wrapping into next year once this year's date has already passed.
function daysUntilNext(mmdd, from) {
  const [month, day] = mmdd.split("-").map(Number);
  const today = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  let target = new Date(from.getFullYear(), month - 1, day);
  if (target < today) target = new Date(from.getFullYear() + 1, month - 1, day);
  return Math.round((target - today) / (1000 * 60 * 60 * 24));
}

// GET /api/customers/upcoming-dates?days=3  (admin) — "Список «скоро
// даты»" (ТЗ 2.3), for a call/message before the date arrives.
export const getUpcomingDates = asyncHandler(async (req, res) => {
  const windowDays = Math.max(0, Number(req.query.days) || 3);
  const now = new Date();

  const customers = await Customer.find({ "importantDates.0": { $exists: true } }).select("name phone importantDates");

  const upcoming = [];
  for (const customer of customers) {
    for (const entry of customer.importantDates) {
      const inDays = daysUntilNext(entry.date, now);
      if (inDays <= windowDays) {
        upcoming.push({
          customerId: customer._id,
          name: customer.name,
          phone: customer.phone,
          occasion: entry.occasion,
          recipient: entry.recipient,
          date: entry.date,
          inDays,
        });
      }
    }
  }
  upcoming.sort((a, b) => a.inDays - b.inDays);
  res.json(upcoming);
});
