import mongoose from "mongoose";

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    // "bouquet" = made from flowers, has a `recipe` driving its cost/
    // category/availability automatically. "addon" = a directly-stocked
    // retail item (vase, chocolate box, toy, certificate) with its own
    // manually-tracked stock, same as how every product used to work.
    kind: { type: String, enum: ["bouquet", "addon"], default: "bouquet" },
    category: { type: mongoose.Schema.Types.ObjectId, ref: "Category", required: true },
    // Bill of materials for a "bouquet" product — which Flowers (and how
    // many of each) it's assembled from. Drives costPrice, category, and
    // stock automatically (see utils/bouquetStock.js) instead of any of
    // those being tracked/purchased on the bouquet itself. Empty for
    // "addon" products, and for any legacy bouquet not yet given one
    // (those keep behaving exactly as before until a recipe is set).
    recipe: {
      type: [
        {
          flower: { type: mongoose.Schema.Types.ObjectId, ref: "Flower", required: true },
          quantity: { type: Number, required: true, min: 1 },
        },
      ],
      default: [],
      _id: false,
    },
    // Who the bouquet suits (see Character model) — powers the homepage
    // quiz's product results. Never left empty: if the admin doesn't pick
    // one, the server assigns a random active Character on save (see
    // products.controller.js) so every product still surfaces somewhere.
    characters: [{ type: mongoose.Schema.Types.ObjectId, ref: "Character" }],
    // Upsell add-on categories this product belongs to (e.g. this product
    // IS a vase/chocolate/toy — see AddonCategory) — shown as options on
    // OTHER products' pages, never auto-assigned.
    addonCategories: [{ type: mongoose.Schema.Types.ObjectId, ref: "AddonCategory" }],
    // What occasion(s) this product suits (see Occasion) — powers the
    // homepage "Свадебная флористика / Корпоративные заказы / ..." section.
    occasions: [{ type: mongoose.Schema.Types.ObjectId, ref: "Occasion" }],

    price: { type: Number, required: true, min: 0 },
    oldPrice: { type: Number, min: 0, default: null },
    currency: { type: String, default: "UZS" },

    // Packaging/ribbon (ТЗ 1.2) — flat admin-entered amounts, deliberately
    // NOT tracked through the warehouse like a recipe's flowers (a basket
    // goes in the recipe instead, same as a flower — see bouquetStock.js):
    // these two default from SiteSettings for a new bouquet but are always
    // a simple per-bouquet number, since precisely metering how much
    // wrapping paper or ribbon one bouquet used isn't the point.
    packagingCost: { type: Number, default: 0, min: 0 },
    ribbonCost: { type: Number, default: 0, min: 0 },
    // Per-bouquet overrides of the global pricing defaults (SiteSettings
    // assemblyPercent/markupMultiplier/deliveryFee) — null means "use the
    // current global default", not "zero".
    assemblyPercent: { type: Number, default: null, min: 0 },
    markupMultiplier: { type: Number, default: null, min: 0 },
    deliveryFee: { type: Number, default: null, min: 0 },
    // Gates whether `price` has ever been deliberately set via one of the
    // two confirm actions (see products.controller.js confirmPrice) rather
    // than just carried over from creation. Defaults true so every bouquet
    // that existed before this feature stays published exactly as-is;
    // explicitly set to false only when a brand-new bouquet is created, so
    // it stays unpublished (ТЗ: "новый букет не публикуется") until the
    // admin actually confirms a price for it at least once.
    priceConfirmed: { type: Boolean, default: true },
    // One entry per confirm action — who, when, what the formula
    // recommended at that moment vs. what was actually set, and by how
    // much they differ. Admin-only audit trail (ТЗ: "в истории товара
    // видно..."), never recomputed or edited after the fact.
    priceHistory: {
      type: [
        {
          at: { type: Date, default: Date.now },
          by: { type: mongoose.Schema.Types.ObjectId, ref: "Admin" },
          recommendedPrice: { type: Number, required: true },
          finalPrice: { type: Number, required: true },
          diffPercent: { type: Number, required: true },
        },
      ],
      default: [],
      _id: false,
    },

    stock: { type: Number, required: true, default: 0, min: 0 },
    // Себестоимость — weighted-average import cost per unit, always in UZS
    // regardless of what currency a given purchase batch was priced in.
    // Recalculated on every warehouse receipt (see PurchaseBatch); read by
    // the Finance module to compute COGS/margin, never shown to customers.
    costPrice: { type: Number, default: 0, min: 0 },

    images: { type: [String], required: true, validate: (v) => v.length > 0 },

    shortDescription: { type: String, required: true, trim: true },
    // Long, unique SEO copy for the product page — NOT a shared template.
    story: { type: String, required: true },
    composition: { type: [String], default: [] },
    careInstructions: { type: String, default: "" },

    seoTitle: { type: String, required: true },
    seoDescription: { type: String, required: true },

    isFeatured: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },

    rating: { type: Number, default: 4.8, min: 0, max: 5 },
    reviewsCount: { type: Number, default: 0 },

    // Deleting from ProductForm is a soft delete, not a real one — set
    // here, never actually removed. Every ordinary find/findOne/count
    // below defaults to excluding these; a future "Корзина" view (none
    // exists yet) would query `deletedAt: { $ne: null }` explicitly to see
    // past this. Aggregate pipelines don't go through query middleware at
    // all, so anywhere Product.aggregate is used has to filter by hand
    // (see finance.controller.js).
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

productSchema.index({ isActive: 1, category: 1 });
productSchema.index({ isActive: 1, characters: 1 });
productSchema.index({ isActive: 1, addonCategories: 1 });
productSchema.index({ isActive: 1, occasions: 1 });
productSchema.index({ isFeatured: 1, isActive: 1 });
productSchema.index({ deletedAt: 1 });

function excludeDeletedByDefault(next) {
  if (this.getQuery().deletedAt === undefined) {
    this.where({ deletedAt: null });
  }
  next();
}
productSchema.pre(["find", "findOne", "countDocuments"], excludeDeletedByDefault);
productSchema.index({ name: "text", shortDescription: "text" });

productSchema.virtual("availability").get(function availability() {
  return this.stock > 0 ? "InStock" : "OutOfStock";
});

productSchema.set("toJSON", { virtuals: true });
productSchema.set("toObject", { virtuals: true });

export default mongoose.models.Product || mongoose.model("Product", productSchema);
