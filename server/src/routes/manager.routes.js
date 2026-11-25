import { Router } from "express";
import { protectManager } from "../middleware/managerAuth.js";
import { getFlowers } from "../controllers/flowers.controller.js";
import { getOverview } from "../controllers/warehouse.controller.js";
import { getProductsAdmin } from "../controllers/products.controller.js";
import { getOrders, createPosOrder } from "../controllers/orders.controller.js";
import { getLeads, updateLeadStatus } from "../controllers/leads.controller.js";

// Every route here reuses an EXISTING admin controller unchanged — none of
// them read req.admin (confirmed directly against the current source), so
// delegating through a different auth middleware is safe. Branch is always
// forced from the authenticated manager's own doc, never trusted from the
// request, since Manager (unlike Admin) is always pinned to exactly one
// branch and has no "pass a different branch" use case at all.
const router = Router();

router.use(protectManager);
// Cheap, defensive-only aliasing in case a future change to createPosOrder/
// getOrders starts reading req.admin for something (e.g. an audit field) —
// not needed today, confirmed by reading both functions' current source.
router.use((req, res, next) => {
  req.admin = req.manager;
  next();
});

router.get("/stock/flowers", getFlowers);
router.get("/stock/overview", getOverview);
router.get("/products", getProductsAdmin);

router.get(
  "/orders",
  (req, res, next) => {
    req.query.branch = String(req.manager.branch);
    next();
  },
  getOrders
);

router.post(
  "/sell",
  (req, res, next) => {
    req.body.branchId = String(req.manager.branch);
    next();
  },
  createPosOrder
);

router.get("/leads", getLeads);
router.patch("/leads/:id", updateLeadStatus);

export default router;
