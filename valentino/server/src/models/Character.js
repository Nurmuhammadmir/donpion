import mongoose from "mongoose";

// "Character" tags a product with the kind of person it suits — used
// exclusively by the homepage quiz (BouquetQuiz), which asks a light
// question about the recipient and shows matching products.
const characterSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    description: { type: String, required: true },
    sortOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

characterSchema.index({ isActive: 1, sortOrder: 1 });

export default mongoose.models.Character || mongoose.model("Character", characterSchema);
