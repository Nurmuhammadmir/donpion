import SiteSettings from "../models/SiteSettings.js";

// The bouquet pricing formula (ТЗ 1.2), pure and synchronous so a caller
// already holding the current SiteSettings (e.g. createOrder pricing many
// items at once) can reuse it without a DB round trip per product.
//   Закупка            = цветы/корзина из рецепта (costPrice) + упаковка + лента
//   Сборка букета       = Закупка × сборка%
//   Себестоимость       = Закупка + Сборка
//   Цена с наценкой     = Себестоимость × наценка
//   Рекомендованная цена = Цена с наценкой + доставка
// A per-bouquet override (assemblyPercent/markupMultiplier/deliveryFee)
// always wins over the global SiteSettings default.
export function computeBreakdown(product, settings) {
  const assemblyPercent = product.assemblyPercent ?? settings.assemblyPercent;
  const markupMultiplier = product.markupMultiplier ?? settings.markupMultiplier;
  const deliveryFee = product.deliveryFee ?? settings.deliveryFee;

  const purchaseTotal = (product.costPrice || 0) + (product.packagingCost || 0) + (product.ribbonCost || 0);
  const assembly = purchaseTotal * (assemblyPercent / 100);
  const costBasis = purchaseTotal + assembly;
  const withMarkup = costBasis * markupMultiplier;
  const recommendedPrice = withMarkup + deliveryFee;

  return { purchaseTotal, assembly, costBasis, withMarkup, deliveryFee, recommendedPrice, assemblyPercent, markupMultiplier };
}

const DEFAULT_SETTINGS = { assemblyPercent: 10, markupMultiplier: 2, deliveryFee: 50000 };

// Convenience wrapper for a single product — confirmPrice only ever prices
// one bouquet per request, so the extra lookup here is a non-issue.
export async function computeRecommendedPrice(product) {
  const settings = await loadPricingDefaults();
  return computeBreakdown(product, settings);
}

// Not named getPricingSettings — that's the admin GET /settings/pricing
// request handler in settings.controller.js; this is just the raw lookup.
export async function loadPricingDefaults() {
  const settings = await SiteSettings.findOne({ key: "homepage" }).select("assemblyPercent markupMultiplier deliveryFee");
  return settings ?? DEFAULT_SETTINGS;
}

// A sale's permanent cost record (ТЗ 1.4), already scaled by quantity — an
// addon has no сборка/доставка concept at all, just its own costPrice.
export function buildItemCostSnapshot(product, quantity, settings) {
  if (product.kind === "bouquet") {
    const { purchaseTotal, assembly, deliveryFee } = computeBreakdown(product, settings);
    return { purchaseTotal: purchaseTotal * quantity, assembly: assembly * quantity, deliveryFee: deliveryFee * quantity };
  }
  return { purchaseTotal: (product.costPrice || 0) * quantity, assembly: 0, deliveryFee: 0 };
}
