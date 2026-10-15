import mongoose from "mongoose";

const customerSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, unique: true, trim: true },
    telegramChatId: { type: String, default: "" },
    telegramUsername: { type: String, default: "" },
    // "Пионы" — internal cashback currency. Credited once an order reaches
    // "completed" (see orders.controller.js), spendable as a discount on a
    // later order's subtotal. Never goes negative — every debit is guarded
    // by an atomic conditional update.
    pointsBalance: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

export default mongoose.models.Customer || mongoose.model("Customer", customerSchema);
