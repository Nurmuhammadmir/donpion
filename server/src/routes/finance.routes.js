import { Router } from "express";
import {
  getFinanceSummary,
  getExpenses,
  createExpense,
  updateExpense,
  deleteExpense,
  getMarginReport,
  exportMarginReport,
  getBalance,
  getBalanceMovements,
  transferBalance,
  adjustBalanceEntry,
} from "../controllers/finance.controller.js";
import { protectAdmin } from "../middleware/auth.js";

const router = Router();

router.get("/summary", protectAdmin, getFinanceSummary);
router.get("/margin-report", protectAdmin, getMarginReport);
router.get("/margin-report/export", protectAdmin, exportMarginReport);
router.get("/expenses", protectAdmin, getExpenses);
router.post("/expenses", protectAdmin, createExpense);
router.put("/expenses/:id", protectAdmin, updateExpense);
router.delete("/expenses/:id", protectAdmin, deleteExpense);
router.get("/balance", protectAdmin, getBalance);
router.get("/balance/movements", protectAdmin, getBalanceMovements);
router.post("/balance/transfer", protectAdmin, transferBalance);
router.post("/balance/adjust", protectAdmin, adjustBalanceEntry);

export default router;
