import asyncHandler from "express-async-handler";
import SiteSettings from "../models/SiteSettings.js";
import { notifyRevalidate } from "../utils/notifyRevalidate.js";

const DEFAULT_HERO_IMAGE =
  "https://images.unsplash.com/photo-1490750967868-88aa4486c946?auto=format&fit=crop&w=1600&q=80";

// GET /api/settings  (public)
export const getSettings = asyncHandler(async (req, res) => {
  let settings = await SiteSettings.findOne({ key: "homepage" });
  if (!settings) {
    settings = await SiteSettings.create({ key: "homepage", heroImage: DEFAULT_HERO_IMAGE });
  }
  res.json(settings);
});

// PUT /api/settings  (admin)
export const updateSettings = asyncHandler(async (req, res) => {
  const { heroImage, heroImageTablet, heroImageMobile, cashbackPercent } = req.body;

  const update = {};
  if (heroImage !== undefined) update.heroImage = heroImage;
  if (heroImageTablet !== undefined) update.heroImageTablet = heroImageTablet;
  if (heroImageMobile !== undefined) update.heroImageMobile = heroImageMobile;
  if (cashbackPercent !== undefined) {
    const percent = Number(cashbackPercent);
    if (!Number.isFinite(percent) || percent < 0 || percent > 100) {
      res.status(400);
      throw new Error("Кешбек должен быть от 0 до 100");
    }
    update.cashbackPercent = percent;
  }

  const settings = await SiteSettings.findOneAndUpdate(
    { key: "homepage" },
    { $set: update },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
  notifyRevalidate();
  res.json(settings);
});
