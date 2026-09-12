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
    // "Пионы" cashback rate, applied to every order's paid amount once it's
    // marked completed (see orders.controller.js). 0 disables the whole
    // system — no further accrual, and the client hides its promo banner.
    // Existing orders/balances are untouched by turning it off or down.
    cashbackPercent: { type: Number, default: 10, min: 0, max: 100 },
    // Below this stock count, the warehouse page flags a product as
    // running low so the florist knows to reorder before it hits zero.
    lowStockThreshold: { type: Number, default: 5, min: 0 },
  },
  { timestamps: true }
);

export default mongoose.models.SiteSettings || mongoose.model("SiteSettings", siteSettingsSchema);
