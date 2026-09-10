import mongoose from "mongoose";

const categorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    shortDescription: { type: String, required: true, trim: true },
    // Long, unique SEO copy for the category page — NOT a shared template.
    introText: { type: String, required: true },
    seoTitle: { type: String, required: true },
    seoDescription: { type: String, required: true },
    image: { type: String, required: true },
    sortOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

categorySchema.index({ isActive: 1, sortOrder: 1 });

export default mongoose.models.Category || mongoose.model("Category", categorySchema);
