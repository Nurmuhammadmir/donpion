import mongoose from "mongoose";

// A category of upsell add-ons shown on the product page (e.g. "Вазы",
// "Шоколад", "Игрушки") — clicking one reveals the actual Products tagged
// with it (see Product.addonCategories) so the customer can add them to
// the same order. Unlike Character, a product is never auto-assigned one —
// most products aren't add-ons at all.
const addonCategorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    sortOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

addonCategorySchema.index({ isActive: 1, sortOrder: 1 });

export default mongoose.models.AddonCategory || mongoose.model("AddonCategory", addonCategorySchema);
