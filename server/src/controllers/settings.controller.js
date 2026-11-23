import asyncHandler from "express-async-handler";
import SiteSettings from "../models/SiteSettings.js";
import { notifyRevalidate } from "../utils/notifyRevalidate.js";

const DEFAULT_HERO_IMAGE =
  "https://images.unsplash.com/photo-1490750967868-88aa4486c946?auto=format&fit=crop&w=1600&q=80";

// GET /api/settings  (public)
export const getSettings = asyncHandler(async (req, res) => {
  let settings = await SiteSettings.findOne({ key: "homepage" }).select("-assemblyPercent -markupMultiplier -deliveryFee");
  if (!settings) {
    settings = await SiteSettings.create({ key: "homepage", heroImage: DEFAULT_HERO_IMAGE });
  }
  res.json(settings);
});

// GET /api/settings/pricing  (admin) — bouquet pricing formula defaults
// (ТЗ 1.2), kept off the public endpoint above since they're the same kind
// of internal-only number as a product's own costPrice.
export const getPricingSettings = asyncHandler(async (req, res) => {
  let settings = await SiteSettings.findOne({ key: "homepage" }).select("assemblyPercent markupMultiplier deliveryFee");
  if (!settings) {
    settings = await SiteSettings.create({ key: "homepage", heroImage: DEFAULT_HERO_IMAGE });
  }
  res.json({
    assemblyPercent: settings.assemblyPercent,
    markupMultiplier: settings.markupMultiplier,
    deliveryFee: settings.deliveryFee,
  });
});

// PUT /api/settings  (admin)
export const updateSettings = asyncHandler(async (req, res) => {
  const { heroImage, heroImageTablet, heroImageMobile, cashbackPercent, lowStockThreshold, assemblyPercent, markupMultiplier, deliveryFee } =
    req.body;

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
  if (lowStockThreshold !== undefined) {
    const threshold = Number(lowStockThreshold);
    if (!Number.isFinite(threshold) || threshold < 0) {
      res.status(400);
      throw new Error("Порог низкого остатка не может быть отрицательным");
    }
    update.lowStockThreshold = threshold;
  }
  if (assemblyPercent !== undefined) {
    const percent = Number(assemblyPercent);
    if (!Number.isFinite(percent) || percent < 0) {
      res.status(400);
      throw new Error("Процент сборки не может быть отрицательным");
    }
    update.assemblyPercent = percent;
  }
  if (markupMultiplier !== undefined) {
    const multiplier = Number(markupMultiplier);
    if (!Number.isFinite(multiplier) || multiplier < 0) {
      res.status(400);
      throw new Error("Множитель наценки не может быть отрицательным");
    }
    update.markupMultiplier = multiplier;
  }
  if (deliveryFee !== undefined) {
    const fee = Number(deliveryFee);
    if (!Number.isFinite(fee) || fee < 0) {
      res.status(400);
      throw new Error("Стоимость доставки не может быть отрицательной");
    }
    update.deliveryFee = fee;
  }

  const settings = await SiteSettings.findOneAndUpdate(
    { key: "homepage" },
    { $set: update },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
  notifyRevalidate();
  res.json(settings);
});
