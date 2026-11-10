import mongoose from "mongoose";

// A raw material — an individual imported flower (by the stem) or other
// piece-bought ingredient (ribbon, foam, a box). This is what "приход"
// actually receives; a Product (bouquet) references these through its
// `recipe` instead of being purchased/stocked directly itself.
const flowerSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    category: { type: mongoose.Schema.Types.ObjectId, ref: "Category", required: true },
    stock: { type: Number, default: 0, min: 0 },
    // Weighted-average cost per unit, always in UZS — recalculated on every
    // purchase batch, same mechanism Product.costPrice used to use directly.
    costPrice: { type: Number, default: 0, min: 0 },
    unit: { type: String, default: "шт" },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

flowerSchema.index({ name: 1 });

export default mongoose.models.Flower || mongoose.model("Flower", flowerSchema);
