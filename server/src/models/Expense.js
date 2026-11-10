import mongoose from "mongoose";

// Every non-flower outflow: packaging, florist wages, rent, marketing.
// Deliberately separate from PurchaseBatch (which is specifically a flower
// stock receipt) — an expense never touches Product.stock/costPrice, it
// only feeds the Finance summary (revenue - COGS - expenses).
const expenseSchema = new mongoose.Schema(
  {
    branch: { type: mongoose.Schema.Types.ObjectId, ref: "Branch", required: true },
    category: {
      type: String,
      enum: ["packaging", "salary", "rent", "utilities", "marketing", "delivery", "other"],
      required: true,
    },
    amount: { type: Number, required: true, min: 0 }, // always UZS
    date: { type: Date, default: Date.now },
    description: { type: String, default: "" },
    isRecurring: { type: Boolean, default: false },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin" },
  },
  { timestamps: true }
);

expenseSchema.index({ branch: 1, date: -1 });
expenseSchema.index({ category: 1, date: -1 });

export default mongoose.models.Expense || mongoose.model("Expense", expenseSchema);
