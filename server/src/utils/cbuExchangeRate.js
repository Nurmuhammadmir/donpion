import PurchaseBatch from "../models/PurchaseBatch.js";

function formatDateForCbu(date) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// CBU's own Date field in its response, "DD.MM.YYYY" — for comparing
// against what was actually requested (see the mismatch check below).
function formatDateRu(date) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${d}.${m}.${y}`;
}

// One day's published USD rate from the Central Bank's archive, or null if
// that specific date has nothing published (not the same as the site being
// down — see getUsdRateForDate, which treats these differently). Confirmed
// live: cbu.uz does NOT 404 or return an empty array for a date it has no
// rate for (e.g. today, before that day's rate is published, or any date
// past its latest archived one) — it silently returns HTTP 200 with its
// most recent available day's rate instead, under that *different* day's
// own Date field. Trusting the rate without checking Date would silently
// mislabel an old rate as this exact date's own — so this only accepts the
// response when its Date actually matches the day requested.
async function fetchCbuRateForExactDate(date) {
  const url = `https://cbu.uz/ru/arkhiv-kursov-valyut/json/USD/${formatDateForCbu(date)}/`;
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) return null;
  const data = await res.json();
  if (data?.[0]?.Date !== formatDateRu(date)) return null;
  const rate = Number(data?.[0]?.Rate);
  return Number.isFinite(rate) && rate > 0 ? rate : null;
}

// Last-resort fallback when cbu.uz can't be reached at all: the most
// recent USD rate we actually paid at in a real purchase batch, rather
// than failing the whole "приход партии" flow outright.
async function lastKnownRateFromOurBatches() {
  const batches = await PurchaseBatch.find({ "items.currency": "USD" })
    .sort({ date: -1 })
    .limit(5)
    .select("items");
  for (const batch of batches) {
    const usdItem = batch.items.find((i) => i.currency === "USD" && i.exchangeRate > 0);
    if (usdItem) return usdItem.exchangeRate;
  }
  return null;
}

// Курс доллара ЦБ на дату прихода партии (ТЗ п.1.1). Tries the Central
// Bank's archive for the exact date first, then walks backward a couple of
// weeks (a specific day can be missing from the archive even though the
// site itself is up), and only falls back to a rate we've actually paid at
// before if cbu.uz is unreachable entirely. `needsReview` tells the admin
// the number on screen isn't that exact day's own published rate, so they
// know to double check it — it never blocks saving the batch.
export async function getUsdRateForDate(dateInput) {
  const requested = new Date(dateInput);
  if (Number.isNaN(requested.getTime())) {
    throw new Error("Некорректная дата");
  }

  for (let back = 0; back <= 14; back += 1) {
    const tryDate = new Date(requested);
    tryDate.setUTCDate(tryDate.getUTCDate() - back);
    try {
      const rate = await fetchCbuRateForExactDate(tryDate);
      if (rate) {
        return { rate, source: "cbu", resolvedDate: formatDateForCbu(tryDate), needsReview: back > 0 };
      }
    } catch {
      // Network/timeout talking to cbu.uz itself — stop walking (retrying
      // 14 more times against a dead host just adds latency) and fall
      // back to our own purchase history below.
      break;
    }
  }

  const fallback = await lastKnownRateFromOurBatches();
  return { rate: fallback, source: "fallback", resolvedDate: null, needsReview: true };
}
