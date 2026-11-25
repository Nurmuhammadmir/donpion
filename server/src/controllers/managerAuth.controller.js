import asyncHandler from "express-async-handler";
import Manager from "../models/Manager.js";
import { generateManagerToken } from "../utils/generateManagerToken.js";
import { notifyAdminLogin } from "../utils/loginAlert.js";

// POST /api/manager/auth/login  (manager app login)
export const managerLogin = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const manager = await Manager.findOne({ email: String(email || "").toLowerCase() });
  if (!manager || !manager.isActive || !(await manager.comparePassword(password))) {
    res.status(401);
    throw new Error("Invalid email or password");
  }

  // notifyAdminLogin only reads .name/.email off the doc it's given, so it
  // works unchanged for a Manager — same owner-facing login-alert channel
  // admin logins already use.
  notifyAdminLogin(manager, req);

  res.json({
    manager: { id: manager._id, name: manager.name, email: manager.email, branch: manager.branch },
    token: generateManagerToken(manager),
  });
});

// GET /api/manager/auth/me  (protected — verifies the current token)
export const managerMe = asyncHandler(async (req, res) => {
  res.json({ manager: req.manager });
});
