import asyncHandler from "express-async-handler";
import Branch from "../models/Branch.js";
import { notifyRevalidate } from "../utils/notifyRevalidate.js";

// GET /api/branches  (public — active only, shown on the storefront footer map)
export const getBranches = asyncHandler(async (req, res) => {
  const branches = await Branch.find({ isActive: true }).sort({ name: 1 });
  res.json(branches);
});

// GET /api/branches/admin/all  (admin — includes inactive)
export const getBranchesAdmin = asyncHandler(async (req, res) => {
  const branches = await Branch.find({}).sort({ name: 1 });
  res.json(branches);
});

// POST /api/branches  (admin)
export const createBranch = asyncHandler(async (req, res) => {
  const branch = await Branch.create(req.body);
  notifyRevalidate();
  res.status(201).json(branch);
});

// PUT /api/branches/:id  (admin)
export const updateBranch = asyncHandler(async (req, res) => {
  const branch = await Branch.findById(req.params.id);
  if (!branch) {
    res.status(404);
    throw new Error("Branch not found");
  }
  Object.assign(branch, req.body);
  await branch.save();
  notifyRevalidate();
  res.json(branch);
});

// DELETE /api/branches/:id  (admin)
export const deleteBranch = asyncHandler(async (req, res) => {
  const branch = await Branch.findById(req.params.id);
  if (!branch) {
    res.status(404);
    throw new Error("Branch not found");
  }
  await branch.deleteOne();
  notifyRevalidate();
  res.json({ message: "Branch deleted" });
});
