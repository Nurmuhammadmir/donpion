import mongoose from "mongoose";

// One imported "party" of flowers — a single invoice from a supplier that
// may cover several individual flower types at once. Creating one is the
// "приход партии" flow: it raises each line's Flower.stock/costPrice (see
// warehouse.controller.js createBatch), cascades into every bouquet Product
// whose recipe uses that flower, and is the audit trail those changes point
// back to.
const batchItemSchema = new mongoose.Schema(
  {
    flower: { type: mongoose.Schema.Types.ObjectId, ref: "Flower", required: true },
    quantity: { type: Number, required: true, min: 1 },
    // Cost per unit in `currency` — converted to UZS via exchangeRate for
    // Flower.costPrice and totalCostUZS below, so mixed-currency line
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
    // Landed-cost overhead for the whole shipment — shipping, customs,
    // broker fees — that isn't any single line's own unit price but still
    // belongs in what the flowers actually cost. Allocated across items by
    // each one's share of the batch's raw goods value (see
    // warehouse.controller.js createBatch) rather than split evenly, so a
    // cheap filler flower doesn't absorb the same overhead as an expensive
    // one — standard landed-cost accounting.
    additionalCost: { type: Number, default: 0, min: 0 },
    additionalCostCurrency: { type: String, enum: ["UZS", "USD"], default: "UZS" },
    additionalCostExchangeRate: { type: Number, default: 1, min: 0 },
    // Sum of (quantity * unitCost * exchangeRate) across items, plus
    // additionalCost*additionalCostExchangeRate — computed server-side on
    // create, never trusted from the client.
    totalCostUZS: { type: Number, required: true, min: 0 },
    notes: { type: String, default: "" },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin" },
  },
  { timestamps: true }
);

purchaseBatchSchema.index({ branch: 1, date: -1 });

export default mongoose.models.PurchaseBatch || mongoose.model("PurchaseBatch", purchaseBatchSchema);
