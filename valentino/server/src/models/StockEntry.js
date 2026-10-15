import mongoose from "mongoose";

// A single line in the warehouse ledger — every change to Product.stock
// (a delivery coming in, a sale, a cancellation restoring stock, or a
// manual correction after a physical recount/breakage) gets one of these,
// so "how much do we have and why" is always answerable instead of stock
// being one number nobody can audit.
const stockEntrySchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    // Signed delta (positive = added, negative = removed) — summing a
    // product's entries always reconciles with its current stock.
    quantity: { type: Number, required: true },
    reason: {
      type: String,
      enum: ["receipt", "sale", "cancel_restock", "adjustment"],
      required: true,
    },
    note: { type: String, default: "" },
    order: { type: mongoose.Schema.Types.ObjectId, ref: "Order" },
  },
  { timestamps: true }
);

stockEntrySchema.index({ product: 1, createdAt: -1 });
stockEntrySchema.index({ createdAt: -1 });

export default mongoose.models.StockEntry || mongoose.model("StockEntry", stockEntrySchema);
