import jwt from "jsonwebtoken";
import asyncHandler from "express-async-handler";
import Admin from "../models/Admin.js";

export const protectAdmin = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization;

  if (!header || !header.startsWith("Bearer ")) {
    res.status(401);
    throw new Error("Not authorized, no token");
  }

  const token = header.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const admin = await Admin.findById(decoded.id).select("-passwordHash");
    if (!admin) {
      res.status(401);
      throw new Error("Not authorized, admin not found");
    }
    req.admin = admin;
    next();
  } catch (err) {
    res.status(401);
    throw new Error("Not authorized, invalid token");
  }
});
