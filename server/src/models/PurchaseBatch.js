import mongoose from "mongoose";

// One imported "party" of flowers — a single invoice from a supplier that
// may cover several products at once. Creating one is the "приход партии"
// flow: it both raises Product.stock/costPrice (see warehouse.controller.js
// createBatch) and is the audit trail those stock changes point back to.
const batchItemSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    quantity: { type: Number, required: true, min: 1 },
    // Cost per unit in `currency` — converted to UZS via exchangeRate for
    // Product.costPrice and totalCostUZS below, so mixed-currency line
    // items on the same invoice still roll up correctly.
    unitCost: { type: Number, required: true, min: 0 },
    currency: { type: String, enum: ["UZS", "USD"], default: "UZS" },
    exchangeRate: { type: Number, default: 1, min: 0 },
  },
  { _id: false }
);

const purchaseBatchSchema = new mongoose.Schema(
  {
    branch: { type: mongoose.Schema.Types.ObjectId, ref: "Branch", required: true },
    supplier: { type: mongoose.Schema.Types.ObjectId, ref: "Supplier", default: null },
    invoiceNumber: { type: String, default: "" },
    date: { type: Date, default: Date.now },
    items: { type: [batchItemSchema], required: true, validate: (v) => v.length > 0 },
    // Sum of (quantity * unitCost * exchangeRate) across items — computed
    // server-side on create, never trusted from the client.
    totalCostUZS: { type: Number, required: true, min: 0 },
    notes: { type: String, default: "" },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin" },
  },
  { timestamps: true }
);

purchaseBatchSchema.index({ branch: 1, date: -1 });

export default mongoose.models.PurchaseBatch || mongoose.model("PurchaseBatch", purchaseBatchSchema);
