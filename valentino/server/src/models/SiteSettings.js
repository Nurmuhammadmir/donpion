import mongoose from "mongoose";

// A single document holding editable homepage content — the hero photo, in
// three independent crops so the admin isn't stuck with one wide desktop
// shot being awkwardly center-cropped on phones/tablets. Only heroImage
// (desktop) is required; the other two fall back to it if never set.
const siteSettingsSchema = new mongoose.Schema(
  {
    key: { type: String, default: "homepage", unique: true },
    heroImage: { type: String, required: true }, // desktop — wide
    heroImageTablet: { type: String, default: null }, // square
    heroImageMobile: { type: String, default: null }, // square
    // Below this stock count, the warehouse page flags a product as
    // running low so the florist knows to reorder before it hits zero.
    lowStockThreshold: { type: Number, default: 5, min: 0 },
  },
  { timestamps: true }
);

export default mongoose.models.SiteSettings || mongoose.model("SiteSettings", siteSettingsSchema);
