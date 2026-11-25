import mongoose from "mongoose";
import bcrypt from "bcryptjs";

// Separate collection from Admin on purpose — a manager's JWT id simply
// doesn't resolve via Admin.findById, so protectAdmin rejects it on every
// existing admin-only route with zero changes to those routes. See the
// "Архитектура авторизации" section of the manager.donpion.uz plan.
const managerSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    // Always required — unlike Admin.branch (null = CEO), a manager is
    // never a head-office account; exactly one branch, always.
    branch: { type: mongoose.Schema.Types.ObjectId, ref: "Branch", required: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

managerSchema.methods.comparePassword = function comparePassword(candidate) {
  return bcrypt.compare(candidate, this.passwordHash);
};

managerSchema.statics.hashPassword = function hashPassword(plain) {
  return bcrypt.hash(plain, 10);
};

export default mongoose.models.Manager || mongoose.model("Manager", managerSchema);
