import asyncHandler from "express-async-handler";
import Order from "../models/Order.js";
import Customer from "../models/Customer.js";
import Product from "../models/Product.js";

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// GET /api/admin/search?q=  (admin) — one search box for the three things
// staff actually look someone/something up by during a shift: an order
// (by number or the customer's name/phone on it), a customer, a product.
// Backs an instant-search dropdown (a handful of each, not a results
// page) — same branch-trust level as the rest of Orders/Customers (not
// the stricter per-branch enforcement Касса uses — see that memory's own
// note on why that one's different: this is a lookup tool, not a balance).
export const globalSearch = asyncHandler(async (req, res) => {
  const q = String(req.query.q || "").trim();
  if (q.length < 2) {
    return res.json({ orders: [], customers: [], products: [] });
  }
  const regex = new RegExp(escapeRegex(q), "i");

  const [orders, customers, products] = await Promise.all([
    Order.find({ $or: [{ orderNumber: regex }, { "customer.name": regex }, { "customer.phone": regex }] })
      .select("orderNumber customer.name customer.phone totalAmount status createdAt")
      .sort({ createdAt: -1 })
      .limit(6),
    Customer.find({ $or: [{ name: regex }, { phone: regex }] })
      .select("name phone pointsBalance")
      .limit(6),
    Product.find({ name: regex, deletedAt: null })
      .select("name slug price images isActive")
      .limit(6),
  ]);

  res.json({ orders, customers, products });
});
