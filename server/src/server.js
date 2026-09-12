// Must run before any local import — ESM evaluates imported modules before
// the rest of this file's own top-level code, so a plain `import dotenv ...`
// + later `dotenv.config()` call would leave process.env unpopulated by the
// time route/controller modules (imported below) are evaluated.
import "dotenv/config";

import path from "path";
import { fileURLToPath } from "url";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import cookieParser from "cookie-parser";

import connectDB from "./config/db.js";
import { notFound, errorHandler } from "./middleware/errorHandler.js";

import productRoutes from "./routes/products.routes.js";
import categoryRoutes from "./routes/categories.routes.js";
import orderRoutes from "./routes/orders.routes.js";
import authRoutes from "./routes/auth.routes.js";
import authCustomerRoutes from "./routes/authCustomer.routes.js";
import uploadRoutes from "./routes/uploads.routes.js";
import characterRoutes from "./routes/characters.routes.js";
import settingsRoutes from "./routes/settings.routes.js";
import branchRoutes from "./routes/branches.routes.js";
import addonCategoryRoutes from "./routes/addonCategories.routes.js";
import occasionRoutes from "./routes/occasions.routes.js";
import warehouseRoutes from "./routes/warehouse.routes.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

// Product photos are fetched cross-origin by both the storefront (port 3000)
// and the admin panel (port 5173), so the default same-origin resource
// policy has to be relaxed for them to load at all.
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(
  cors({
    origin: [process.env.CLIENT_URL, process.env.ADMIN_URL].filter(Boolean),
    credentials: true,
  })
);
app.use(express.json({ limit: "2mb" }));
app.use(cookieParser());
app.use(morgan("dev"));

// Uploaded product photos — filenames are unique per upload, so a long
// cache lifetime is safe and speeds up repeat visits.
app.use(
  "/uploads",
  express.static(path.join(__dirname, "../public/uploads"), {
    maxAge: "30d",
    immutable: true,
  })
);

app.get("/api/health", (req, res) => res.json({ ok: true, timestamp: new Date().toISOString() }));

app.use("/api/products", productRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/auth/customer", authCustomerRoutes);
app.use("/api/uploads", uploadRoutes);
app.use("/api/characters", characterRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/branches", branchRoutes);
app.use("/api/addon-categories", addonCategoryRoutes);
app.use("/api/occasions", occasionRoutes);
app.use("/api/warehouse", warehouseRoutes);

app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 4000;

connectDB()
  .then(() => {
    app.listen(PORT, () => console.log(`Flower shop API running on http://localhost:${PORT}`));
  })
  .catch((err) => {
    console.error("Failed to connect to MongoDB:", err.message);
    process.exit(1);
  });
