import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const adminSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ["admin", "superadmin"], default: "admin" },
    // null = CEO/head-office view — sees every branch and can switch
    // between them. Set = this account is scoped to one branch (its own
    // orders/finance/warehouse views default to it, no switcher shown).
    branch: { type: mongoose.Schema.Types.ObjectId, ref: "Branch", default: null },
  },
  { timestamps: true }
);

adminSchema.methods.comparePassword = function comparePassword(candidate) {
  return bcrypt.compare(candidate, this.passwordHash);
};

adminSchema.statics.hashPassword = function hashPassword(plain) {
  return bcrypt.hash(plain, 10);
};

export default mongoose.models.Admin || mongoose.model("Admin", adminSchema);
