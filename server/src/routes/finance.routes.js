import { Router } from "express";
import {
  getFinanceSummary,
  getExpenses,
  createExpense,
  updateExpense,
  deleteExpense,
} from "../controllers/finance.controller.js";
import { protectAdmin } from "../middleware/auth.js";

const router = Router();

router.get("/summary", protectAdmin, getFinanceSummary);
router.get("/expenses", protectAdmin, getExpenses);
router.post("/expenses", protectAdmin, createExpense);
router.put("/expenses/:id", protectAdmin, updateExpense);
router.delete("/expenses/:id", protectAdmin, deleteExpense);

export default router;
