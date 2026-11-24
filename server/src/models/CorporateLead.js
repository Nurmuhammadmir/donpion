import mongoose from "mongoose";

// "Запросить расчёт" on the corporate-orders landing (see
// corporateLeads.controller.js) — deliberately NOT gated behind the
// phone+Telegram customer login every real order requires: a business
// buyer asking for a quote shouldn't have to register first. Just a lead
// to call back, not an order — no payment, no items, no stock effect.
const corporateLeadSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    companyName: { type: String, default: "", trim: true },
    comment: { type: String, default: "", maxlength: 1000 },
    status: { type: String, enum: ["new", "contacted", "closed"], default: "new" },
  },
  { timestamps: true }
);

corporateLeadSchema.index({ status: 1, createdAt: -1 });

export default mongoose.models.CorporateLead || mongoose.model("CorporateLead", corporateLeadSchema);
