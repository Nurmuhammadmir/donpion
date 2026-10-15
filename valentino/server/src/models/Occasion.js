import mongoose from "mongoose";

// "Occasion" tags a product with what it's for (e.g. "Свадебная
// флористика", "Корпоративные заказы") — powers the homepage section
// right after the personality quiz, same click-to-see-matching-products
// mechanism as Character/BouquetQuiz. Not auto-assigned — a product can
// belong to zero, one, or several occasions.
const occasionSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    description: { type: String, default: "" },
    sortOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

occasionSchema.index({ isActive: 1, sortOrder: 1 });

export default mongoose.models.Occasion || mongoose.model("Occasion", occasionSchema);
