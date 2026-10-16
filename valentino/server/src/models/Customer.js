import mongoose from "mongoose";

const customerSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, unique: true, trim: true },
    telegramChatId: { type: String, default: "" },
    telegramUsername: { type: String, default: "" },
  },
  { timestamps: true }
);

export default mongoose.models.Customer || mongoose.model("Customer", customerSchema);
