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
    // "Важные даты" (ТЗ 2.3) — one array covers день рождения, годовщина,
    // or anything else the florist wants reminded of, plus who it's for
    // ("кому дарит") when that's not the customer themself. `date` is
    // "MM-DD" (no year — a birthday recurs every year regardless of it) so
    // the "скоро даты" check is a plain month/day comparison.
    importantDates: {
      type: [
        {
          occasion: { type: String, required: true, trim: true },
          date: { type: String, required: true, match: /^\d{2}-\d{2}$/ },
          recipient: { type: String, default: "", trim: true },
        },
      ],
      default: [],
      _id: false,
    },
  },
  { timestamps: true }
);

export default mongoose.models.Customer || mongoose.model("Customer", customerSchema);
