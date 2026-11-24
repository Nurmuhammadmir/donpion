import mongoose from "mongoose";

// Append-only log behind the Касса/Баланс admin screen — every change to
// Branch.cashBalance / SiteSettings.bankBalance goes through here (see
// utils/cashBalance.js) so the owner can see *why* a number is what it is,
// not just the number itself.
const cashMovementSchema = new mongoose.Schema(
  {
    bucket: { type: String, enum: ["cash", "bank"], required: true },
    // Only meaningful for "cash" — which till. Always null for "bank": one
    // shared company account, not split by branch.
    branch: { type: mongoose.Schema.Types.ObjectId, ref: "Branch", default: null },
    amount: { type: Number, required: true }, // signed — +in, -out
    balanceAfter: { type: Number, required: true },
    reason: {
      type: String,
      enum: ["order_payment", "expense", "transfer_to_bank", "manual_adjustment"],
      required: true,
    },
    order: { type: mongoose.Schema.Types.ObjectId, ref: "Order", default: null },
    expense: { type: mongoose.Schema.Types.ObjectId, ref: "Expense", default: null },
    // Set instead of `order` for a "pay on delivery" subscription delivery
    // (see subscriptions.controller.js) — that payment was never a real
    // Order, so it isn't mixed into the `order` ref above.
    subscription: { type: mongoose.Schema.Types.ObjectId, ref: "Subscription", default: null },
    note: { type: String, default: "" },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", default: null },
  },
  { timestamps: true }
);

cashMovementSchema.index({ bucket: 1, branch: 1, createdAt: -1 });

export default mongoose.models.CashMovement || mongoose.model("CashMovement", cashMovementSchema);
