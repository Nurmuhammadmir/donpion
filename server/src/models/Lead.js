import mongoose from "mongoose";

// A prospective customer who reached out, but hasn't (yet) placed an
// order — from the site's general contact form, or an Instagram DM to the
// shop's account (see routes/instagram.routes.js). Deliberately shared
// between both channels rather than two separate models: the manager app's
// "Лиды" inbox is one merged list either way. No `branch` field — neither
// channel carries branch information (one shared Instagram account, one
// site-wide form), so every lead is visible to every manager, same
// reasoning as Flower.stock being one shared pool rather than per-branch.
const leadSchema = new mongoose.Schema(
  {
    channel: { type: String, enum: ["site_form", "instagram"], required: true },
    name: { type: String, default: "", trim: true },
    phone: { type: String, default: "", trim: true },
    // Latest message, for the inbox list view without populating `messages`.
    message: { type: String, default: "", maxlength: 2000 },
    // A small thread — one entry for a site_form submission, grows with
    // every follow-up DM for an instagram lead (see instagram.controller.js).
    messages: {
      type: [
        {
          text: { type: String, default: "" },
          at: { type: Date, default: Date.now },
        },
      ],
      default: [],
      _id: false,
    },
    // IGSID — set only for channel:"instagram", used to upsert on repeat
    // messages from the same person instead of creating a new lead each time.
    instagramUserId: { type: String, default: "" },
    // Filled in later, best-effort, via a Graph API lookup — not available
    // from the webhook payload itself.
    instagramUsername: { type: String, default: "" },
    status: { type: String, enum: ["new", "contacted", "closed"], default: "new" },
  },
  { timestamps: true }
);

leadSchema.index({ status: 1, createdAt: -1 });
leadSchema.index({ channel: 1, createdAt: -1 });
leadSchema.index({ instagramUserId: 1 });

export default mongoose.models.Lead || mongoose.model("Lead", leadSchema);
