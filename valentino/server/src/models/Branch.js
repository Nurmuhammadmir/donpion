import mongoose from "mongoose";

// A physical shop location — shown on the storefront footer map and used
// as the destination when a customer taps "get directions" to a branch.
const branchSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    address: { type: String, required: true, trim: true },
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
    phone: { type: String, default: "" },
    workingHours: { type: String, default: "" },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default mongoose.models.Branch || mongoose.model("Branch", branchSchema);
