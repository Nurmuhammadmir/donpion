import dotenv from "dotenv";
import connectDB from "../config/db.js";
import Category from "../models/Category.js";
import Product from "../models/Product.js";
import Character from "../models/Character.js";
import SiteSettings from "../models/SiteSettings.js";
import Admin from "../models/Admin.js";
import { categories, products } from "./seedData.js";

dotenv.config();

const DEFAULT_HERO_IMAGE =
  "https://images.unsplash.com/photo-1490750967868-88aa4486c946?auto=format&fit=crop&w=1600&q=80";

const characters = [
  {
    name: "Романтичная и нежная",
    slug: "romantichnaya-i-nezhnaya",
    description:
      "Ценит трогательные детали и классическую нежность — пионовидные розы, пастельные тона, воздушные композиции.",
    sortOrder: 1,
  },
  {
    name: "Лёгкая на подъём, любит сюрпризы",
    slug: "lyogkaya-na-podyom",
    description:
      "Живая и спонтанная — яркие, неформальные букеты без строгой симметрии, которые поднимают настроение.",
    sortOrder: 2,
  },
  {
    name: "Ценит статус и вау-эффект",
    slug: "tsenit-status",
    description: "Любит масштаб и премиальность — крупные композиции, редкие сорта, всё то, что заметно с первого взгляда.",
    sortOrder: 3,
  },
];

// This is a production-facing seed: it only ever creates the *structural*
// content the site needs to function (botanical categories, quiz
// characters, homepage settings, the first admin login) — never fake
// products. Real products are added exclusively through the admin panel,
// with real uploaded photos. Pass --with-demo-products to also load the
// sample catalog from seedData.js for local development/demos only.
async function run() {
  await connectDB();

  const destroy = process.argv.includes("--destroy");
  const withDemoProducts = process.argv.includes("--with-demo-products");

  if (destroy) {
    await Promise.all([
      Category.deleteMany({}),
      Product.deleteMany({}),
      Character.deleteMany({}),
      SiteSettings.deleteMany({}),
      Admin.deleteMany({}),
    ]);
    console.log("All categories, products, characters, settings and admins removed.");
    process.exit(0);
  }

  if (await Category.countDocuments()) {
    console.log("Categories already exist — skipping (run with --destroy first to reset).");
  } else {
    const createdCategories = await Category.insertMany(categories);
    console.log(`Seeded ${createdCategories.length} categories.`);

    if (withDemoProducts) {
      const categoryIdBySlug = new Map(createdCategories.map((c) => [c.slug, c._id]));
      const productsWithCategory = products.map(({ categorySlug, ...rest }) => ({
        ...rest,
        category: categoryIdBySlug.get(categorySlug),
      }));
      await Product.insertMany(productsWithCategory);
      console.log(`Seeded ${productsWithCategory.length} DEMO products (--with-demo-products) — remove before going live.`);
    }
  }

  if (await Character.countDocuments()) {
    console.log("Characters already exist — skipping.");
  } else {
    await Character.insertMany(characters);
    console.log(`Seeded ${characters.length} characters.`);
  }

  const existingSettings = await SiteSettings.findOne({ key: "homepage" });
  if (existingSettings) {
    console.log("Site settings already exist — skipping.");
  } else {
    await SiteSettings.create({ key: "homepage", heroImage: DEFAULT_HERO_IMAGE });
    console.log("Site settings created (placeholder hero image — replace via admin panel).");
  }

  const adminEmail = (process.env.SEED_ADMIN_EMAIL || "admin@flowershop.uz").toLowerCase();
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || "change-me-now";

  const existingAdmin = await Admin.findOne({ email: adminEmail });
  if (!existingAdmin) {
    const passwordHash = await Admin.hashPassword(adminPassword);
    await Admin.create({
      name: "Администратор",
      email: adminEmail,
      passwordHash,
      role: "superadmin",
    });
    console.log(`Admin user created: ${adminEmail} / ${adminPassword}`);
  } else {
    console.log(`Admin user already exists: ${adminEmail}`);
  }

  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
