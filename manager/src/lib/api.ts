const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4100/api";
const TOKEN_KEY = "flower-shop-manager-token";

// Where uploaded product photos are actually served from (the server's
// /uploads static route) — derived from the API URL so there's only one
// place to change when deploying to a real domain. Same derivation as
// admin/src/lib/api.ts.
export const ASSET_ORIGIN = API_URL.replace(/\/api\/?$/, "");

export function resolveImageUrl(src: string): string {
  if (!src) return src;
  if (/^https?:\/\//i.test(src)) return src;
  return `${ASSET_ORIGIN}${src.startsWith("/") ? "" : "/"}${src}`;
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

// Same pattern as admin/src/lib/api.ts: any page's 401 (expired/invalid
// token, not just the one-time check on mount) runs this, AuthContext
// registers itself here so the token/state is cleared from one place.
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

// ---- Typed convenience wrappers — the manager API surface --------------
// Every one of these hits a route mounted under /api/manager/... and
// forced to the logged-in manager's own branch server-side (see
// server/src/routes/manager.routes.js) — none of these take a branch/
// branchId param, on purpose: there is nothing for this app to pass.

import type { Branch, Flower, Lead, LeadStatus, Order, Product, WarehouseOverview } from "./types";

export function getBranches() {
  return api<Branch[]>("/branches");
}

export function getStockFlowers(search?: string) {
  const qs = search ? `?search=${encodeURIComponent(search)}` : "";
  return api<Flower[]>(`/manager/stock/flowers${qs}`);
}

export function getStockOverview() {
  return api<WarehouseOverview>("/manager/stock/overview");
}

export function searchManagerProducts(query: string) {
  const qs = query.trim() ? `?search=${encodeURIComponent(query.trim())}&limit=20` : "?limit=20";
  return api<{ items: Product[] }>(`/manager/products${qs}`);
}

export function getManagerOrders(params: { status?: string; limit?: number } = {}) {
  const qs = new URLSearchParams();
  if (params.status) qs.set("status", params.status);
  qs.set("limit", String(params.limit ?? 50));
  return api<{ items: Order[]; total: number }>(`/manager/orders?${qs.toString()}`);
}

// No branchId field here, deliberately — the server derives it from the
// logged-in manager's own account, never from the client.
export function createManagerSale(payload: {
  items: { productId: string; quantity: number }[];
  paymentMethod: "cash" | "card";
  customerName?: string;
  customerPhone?: string;
}) {
  return api<Order>("/manager/sell", { method: "POST", body: JSON.stringify(payload) });
}

export function getManagerLeads(params: { status?: string; channel?: string } = {}) {
  const qs = new URLSearchParams();
  if (params.status) qs.set("status", params.status);
  if (params.channel) qs.set("channel", params.channel);
  const query = qs.toString();
  return api<Lead[]>(`/manager/leads${query ? `?${query}` : ""}`);
}

export function updateManagerLeadStatus(id: string, status: LeadStatus) {
  return api<Lead>(`/manager/leads/${id}`, { method: "PATCH", body: JSON.stringify({ status }) });
}
