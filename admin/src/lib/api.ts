const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4100/api";
const TOKEN_KEY = "flower-shop-admin-token";

// Where uploaded product photos are actually served from (the server's
// /uploads static route) — derived from the API URL so there's only one
// place to change when deploying to a real domain.
export const ASSET_ORIGIN = API_URL.replace(/\/api\/?$/, "");

// Product images are stored as either a relative server path
// ("/uploads/xxx.webp") or a full external URL (legacy data) — this
// resolves either form to something an <img> tag can load directly.
export function resolveImageUrl(src: string): string {
  if (!src) return src;
  if (/^https?:\/\//i.test(src)) return src;
  return `${ASSET_ORIGIN}${src.startsWith("/") ? "" : "/"}${src}`;
}

// A product's media slot can hold a short clip instead of a photo — there's
// no separate field for it, so anywhere `images` gets rendered has to check
// each URL itself to know whether it needs <video> instead of <img>.
export function isVideoUrl(src: string): boolean {
  return /\.(mp4|webm|mov)$/i.test(src);
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

// A stale/expired/invalid token surfaces here as a 401 from any page's
// fetch — not just the one-time check on app mount. AuthContext registers
// itself here so every 401, from any page, clears the token and flips
// `admin` back to null in one place; ProtectedRoute then redirects to
// /login on its own instead of the page quietly rendering an empty state.
let onUnauthorized: (() => void) | null = null;
export function setUnauthorizedHandler(handler: () => void) {
  onUnauthorized = handler;
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (!res.ok) {
    if (res.status === 401) onUnauthorized?.();
    const body = await res.json().catch(() => ({ message: res.statusText }));
    throw new ApiError(body.message || "Request failed", res.status);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

// ---- Typed convenience wrappers for the CRM modules --------------------
// Thin, non-magic wrappers around api<T>() — purely so every module page
// builds the same request shape instead of each one re-deriving it.

export function createPosOrder(payload: {
  items: { productId: string; quantity: number }[];
  paymentMethod: "cash" | "card";
  branchId: string;
  customerName?: string;
  customerPhone?: string;
}) {
  return api("/orders/pos", { method: "POST", body: JSON.stringify(payload) });
}

export function getFinanceSummary(params: { branch?: string | null; from?: string; to?: string }) {
  const qs = new URLSearchParams();
  if (params.branch) qs.set("branch", params.branch);
  if (params.from) qs.set("from", params.from);
  if (params.to) qs.set("to", params.to);
  const query = qs.toString();
  return api(`/finance/summary${query ? `?${query}` : ""}`);
}

function marginReportQuery(params: { branch?: string | null; from?: string; to?: string; groupBy?: "day" | "week" | "month" }) {
  const qs = new URLSearchParams();
  if (params.branch) qs.set("branch", params.branch);
  if (params.from) qs.set("from", params.from);
  if (params.to) qs.set("to", params.to);
  if (params.groupBy) qs.set("groupBy", params.groupBy);
  return qs.toString();
}

// ТЗ 1.4 — выручка/закупка/сборка/доставка/маржа за период, по заказам,
// по букетам и по филиалам.
export function getMarginReport(params: { branch?: string | null; from?: string; to?: string; groupBy?: "day" | "week" | "month" }) {
  return api(`/finance/margin-report?${marginReportQuery(params)}`);
}

// CSV (Excel opens it natively) — a plain <a href> can't carry the auth
// header, so this fetches it as the logged-in admin and hands the browser
// a Blob to save instead.
export async function downloadMarginReportCsv(params: { branch?: string | null; from?: string; to?: string; groupBy?: "day" | "week" | "month" }) {
  const token = getToken();
  const res = await fetch(`${API_URL}/finance/margin-report/export?${marginReportQuery(params)}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  if (!res.ok) {
    if (res.status === 401) onUnauthorized?.();
    throw new ApiError("Не удалось выгрузить отчёт", res.status);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = res.headers.get("Content-Disposition")?.match(/filename="(.+)"/)?.[1] || "marzha.csv";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function createPurchaseBatch(payload: {
  branchId: string;
  supplierId?: string | null;
  invoiceNumber?: string;
  date?: string;
  notes?: string;
  items: { flowerId: string; quantity: number; unitCost: number; currency: "UZS" | "USD"; exchangeRate?: number }[];
  // Landed-cost overhead for the whole shipment (shipping, customs,
  // broker fees) — allocated server-side across items by their share of
  // raw goods value, not split evenly per stem.
  additionalCost?: number;
  additionalCostCurrency?: "UZS" | "USD";
  additionalCostExchangeRate?: number;
  // True if any USD rate below came from the fallback (last known) path
  // rather than that exact date's own Central Bank rate — see
  // getExchangeRate below.
  rateNeedsReview?: boolean;
}) {
  return api("/warehouse/batches", { method: "POST", body: JSON.stringify(payload) });
}

// The Central Bank's USD rate for a given date (ТЗ п.1.1) — auto-fills a
// batch's exchange rate instead of making the admin look it up by hand.
export function getExchangeRate(date: string) {
  return api<{ rate: number | null; source: "cbu" | "fallback"; resolvedDate: string | null; needsReview: boolean }>(
    `/warehouse/exchange-rate?date=${encodeURIComponent(date)}`,
  );
}

// "Списать" (ТЗ 2.1) — either a flower (flowerId) or a directly-stocked
// addon (productId), never both. `photo` is already an uploaded URL from
// uploadProductImages, not a File.
export function createWriteoff(payload: {
  flowerId?: string;
  productId?: string;
  quantity: number;
  reason: "defect_on_receipt" | "wilted" | "broken" | "other";
  note?: string;
  photo?: string;
}) {
  return api("/warehouse/writeoffs", { method: "POST", body: JSON.stringify(payload) });
}

export function getWriteoffReport(params: { from?: string; to?: string }) {
  const qs = new URLSearchParams();
  if (params.from) qs.set("from", params.from);
  if (params.to) qs.set("to", params.to);
  return api(`/warehouse/writeoffs/report?${qs.toString()}`);
}

// Flowers — the individual, piece-imported raw material a bouquet's
// recipe is built from. Used both by the Приход/Партии flow above and by
// a bouquet's recipe editor.
export function getFlowers(search?: string) {
  const qs = search ? `?search=${encodeURIComponent(search)}` : "";
  return api(`/flowers${qs}`);
}

export function createFlower(payload: {
  name: string;
  category?: string;
  unit?: string;
  type?: "flower" | "greenery" | "packaging" | "ribbon" | "basket";
}) {
  return api("/flowers", { method: "POST", body: JSON.stringify(payload) });
}

// File uploads use multipart/form-data — deliberately bypasses the JSON
// helper above so the browser can set its own multipart boundary header.
export async function uploadProductImages(files: File[], nameHint: string): Promise<string[]> {
  const token = getToken();
  const form = new FormData();
  form.append("nameHint", nameHint || "buket");
  files.forEach((file) => form.append("images", file));

  const res = await fetch(`${API_URL}/uploads`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body: form,
  });

  if (!res.ok) {
    if (res.status === 401) onUnauthorized?.();
    const body = await res.json().catch(() => ({ message: res.statusText }));
    throw new ApiError(body.message || "Upload failed", res.status);
  }

  const data = (await res.json()) as { urls: string[] };
  return data.urls;
}

// Bouquet pricing formula (ТЗ 1.2) — the global defaults (admin-only,
// separate from the public GET /settings), and confirming a bouquet's own
// price. confirmPrice also carries the pricing-input fields so confirming
// always acts on exactly what's in the form, not whatever was last saved.
export function getPricingSettings() {
  return api<{ assemblyPercent: number; markupMultiplier: number; deliveryFee: number }>("/settings/pricing");
}

export function confirmPrice(
  productId: string,
  payload:
    | {
        mode: "recommended" | "custom";
        price?: number;
        packagingCost: number;
        ribbonCost: number;
        assemblyPercent: number | null;
        markupMultiplier: number | null;
        deliveryFee: number | null;
      }
) {
  return api(`/products/${productId}/confirm-price`, { method: "POST", body: JSON.stringify(payload) });
}
