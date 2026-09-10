import mongoose from "mongoose";

// One registration attempt, potentially delivered through both Telegram
// channels at once: registrationId is our own id (also used as the bot's
// /start deep-link parameter); gatewayRequestId is Telegram Gateway's
// handle, set whenever that send succeeded; botCode fills in once the
// visitor presses Start in the bot. verify() accepts a match against
// either channel — whichever actually reached them. Deleted the moment
// it's successfully verified; the TTL index sweeps up anything abandoned
// in between.
const phoneVerificationSchema = new mongoose.Schema(
  {
    registrationId: { type: String, required: true, unique: true },
    gatewayRequestId: { type: String, default: "" },
    botCode: { type: String, default: "" },
    botAttempts: { type: Number, default: 0 },
    telegramChatId: { type: String, default: "" },
    telegramUsername: { type: String, default: "" },
    // Unique so a retry (double-click, "code didn't arrive") can be
    // resolved with one atomic upsert instead of a separate delete+create —
    // two near-simultaneous requests for the same phone can then never both
    // leave a live record behind with two different codes.
    phone: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
);

phoneVerificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.models.PhoneVerification ||
  mongoose.model("PhoneVerification", phoneVerificationSchema);
