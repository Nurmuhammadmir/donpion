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
