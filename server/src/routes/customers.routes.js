import { Router } from "express";
import { getCustomers, getCustomerById, updateCustomer, getUpcomingDates } from "../controllers/customers.controller.js";
import { protectAdmin } from "../middleware/auth.js";

const router = Router();

router.get("/upcoming-dates", protectAdmin, getUpcomingDates);
router.get("/", protectAdmin, getCustomers);
router.get("/:id", protectAdmin, getCustomerById);
router.put("/:id", protectAdmin, updateCustomer);

export default router;
