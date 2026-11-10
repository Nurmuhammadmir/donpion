import mongoose from "mongoose";

// A single line in the warehouse ledger — every change to Product.stock
// (a delivery coming in, a sale, a cancellation restoring stock, or a
// manual correction after a physical recount/breakage) gets one of these,
// so "how much do we have and why" is always answerable instead of stock
// being one number nobody can audit.
const stockEntrySchema = new mongoose.Schema(
  {
    // Exactly one of product/flower is set — product for an addon's direct
    // stock movement (unchanged, legacy behavior), flower for the real
    // warehouse movements (приход, and the flower side of a bouquet sale).
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
    flower: { type: mongoose.Schema.Types.ObjectId, ref: "Flower" },
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
    // Which branch this movement is attributed to (POS sale, pickup order,
    // or a purchase batch received there) — null for online delivery
    // orders, which aren't tied to any physical location.
    branch: { type: mongoose.Schema.Types.ObjectId, ref: "Branch", default: null },
    // Set on "receipt" entries created from a PurchaseBatch, so a batch's
    // ledger lines can be traced back to the invoice that created them.
    batch: { type: mongoose.Schema.Types.ObjectId, ref: "PurchaseBatch", default: null },
    // Snapshot of Product.costPrice at the moment of this entry — kept
    // alongside the ledger line so Finance can compute historically
    // accurate COGS even after later purchases change the running average.
    unitCost: { type: Number, default: null },
  },
  { timestamps: true }
);

stockEntrySchema.index({ product: 1, createdAt: -1 });
stockEntrySchema.index({ flower: 1, createdAt: -1 });
stockEntrySchema.index({ createdAt: -1 });

export default mongoose.models.StockEntry || mongoose.model("StockEntry", stockEntrySchema);
