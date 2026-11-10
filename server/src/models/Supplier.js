import mongoose from "mongoose";

// Who a flower purchase batch was bought from — a Dutch/Kenyan/Ecuadorian
// farm, a local distributor, etc. Kept separate from PurchaseBatch so the
// same supplier can be reused invoice after invoice instead of retyped.
const supplierSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    country: { type: String, default: "" },
    contactPerson: { type: String, default: "" },
    phone: { type: String, default: "" },
    notes: { type: String, default: "" },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default mongoose.models.Supplier || mongoose.model("Supplier", supplierSchema);
