import jwt from "jsonwebtoken";

// Deliberate small duplicate of generateToken.js (Admin) rather than a
// shared generic signer — same low-abstraction style as the rest of this
// codebase, and isolation here comes from the separate Manager collection,
// not from this function.
export function generateManagerToken(manager) {
  return jwt.sign(
    { id: manager._id, email: manager.email, role: "manager" },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
  );
}
