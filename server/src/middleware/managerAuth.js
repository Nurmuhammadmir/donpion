import jwt from "jsonwebtoken";
import asyncHandler from "express-async-handler";
import Manager from "../models/Manager.js";

export const protectManager = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization;

  if (!header || !header.startsWith("Bearer ")) {
    res.status(401);
    throw new Error("Not authorized, no token");
  }

  const token = header.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const manager = await Manager.findById(decoded.id).select("-passwordHash");
    if (!manager) {
      res.status(401);
      throw new Error("Not authorized, manager not found");
    }
    // Admin has no equivalent flag — a disabled Manager account is meant to
    // lose access immediately, not just stop appearing in some list.
    if (!manager.isActive) {
      res.status(401);
      throw new Error("Account disabled");
    }
    req.manager = manager;
    next();
  } catch (err) {
    res.status(401);
    throw new Error("Not authorized, invalid token");
  }
});
