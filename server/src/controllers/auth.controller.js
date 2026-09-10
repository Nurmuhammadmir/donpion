import asyncHandler from "express-async-handler";
import Admin from "../models/Admin.js";
import { generateToken } from "../utils/generateToken.js";

// POST /api/auth/login  (admin panel login)
export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const admin = await Admin.findOne({ email: String(email).toLowerCase() });
  if (!admin || !(await admin.comparePassword(password))) {
    res.status(401);
    throw new Error("Invalid email or password");
  }

  res.json({
    admin: { id: admin._id, name: admin.name, email: admin.email, role: admin.role },
    token: generateToken(admin),
  });
});

// GET /api/auth/me  (protected — verifies the current token)
export const me = asyncHandler(async (req, res) => {
  res.json({ admin: req.admin });
});
