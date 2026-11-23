import SiteSettings from "../models/SiteSettings.js";

// The bouquet pricing formula (ТЗ 1.2), computed authoritatively here
// rather than trusted from the client — confirmPrice below is the only
// place this actually sets a product's real `price`, so it always
// recomputes from the product's own current costPrice/packaging/ribbon and
// the live settings/overrides, never from a number the admin UI merely
// displayed a moment earlier.
//   Закупка            = цветы/корзина из рецепта (costPrice) + упаковка + лента
//   Сборка букета       = Закупка × сборка%
//   Себестоимость       = Закупка + Сборка
//   Цена с наценкой     = Себестоимость × наценка
//   Рекомендованная цена = Цена с наценкой + доставка
// A per-bouquet override (assemblyPercent/markupMultiplier/deliveryFee)
// always wins over the global SiteSettings default.
export async function computeRecommendedPrice(product) {
  let settings = await SiteSettings.findOne({ key: "homepage" }).select("assemblyPercent markupMultiplier deliveryFee");
  if (!settings) settings = { assemblyPercent: 10, markupMultiplier: 2, deliveryFee: 50000 };

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
