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
    // The default branch new records (orders, expenses, purchase batches)
    // are attributed to when no branch is explicitly chosen — e.g. online
    // delivery orders, which aren't tied to any physical pickup point.
    isMain: { type: Boolean, default: false },
    // Running cash-on-hand for this branch's physical till — "сколько в
    // кассе" (see utils/cashBalance.js). Starts at 0; the admin sets the
    // real opening count once via a manual adjustment, same action used
    // later to correct it after a miscount.
    cashBalance: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export default mongoose.models.Branch || mongoose.model("Branch", branchSchema);
