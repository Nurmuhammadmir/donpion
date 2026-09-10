import type {
  Branch,
  Category,
  Character,
  Product,
  ProductDetailResponse,
  ProductListResponse,
  SiteSettings,
} from "@/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4100/api";

// How long ISR pages may serve a cached copy before Next.js regenerates them
// in the background. Product/category content doesn't change every second,
// so a moderate window keeps the site fast without going stale for long.
export const REVALIDATE_SECONDS = 60 * 10; // 10 minutes

async function apiFetch<T>(path: string, revalidate: number = REVALIDATE_SECONDS): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    next: { revalidate },
  });

  if (!res.ok) {
    throw new Error(`API ${path} responded with ${res.status}`);
  }

  return res.json() as Promise<T>;
}

export async function getCategories(): Promise<Category[]> {
  try {
    return await apiFetch<Category[]>("/categories");
  } catch {
    return [];
  }
}

export async function getCategoryBySlug(slug: string): Promise<Category | null> {
  try {
    return await apiFetch<Category>(`/categories/${slug}`);
  } catch {
    return null;
  }
}

export async function getCharacters(): Promise<Character[]> {
  try {
    return await apiFetch<Character[]>("/characters");
  } catch {
    return [];
  }
}

export async function getCharacterBySlug(slug: string): Promise<Character | null> {
  try {
    return await apiFetch<Character>(`/characters/${slug}`);
  } catch {
    return null;
  }
}

export async function getBranches(): Promise<Branch[]> {
  try {
    return await apiFetch<Branch[]>("/branches");
  } catch {
    return [];
  }
}

const DEFAULT_SITE_SETTINGS: SiteSettings = {
  heroImage: "https://images.unsplash.com/photo-1490750967868-88aa4486c946?auto=format&fit=crop&w=1600&q=80",
  cashbackPercent: 0,
};

export async function getSiteSettings(): Promise<SiteSettings> {
  try {
    return await apiFetch<SiteSettings>("/settings");
  } catch {
    return DEFAULT_SITE_SETTINGS;
  }
}

export async function getProducts(params: {
  category?: string;
  character?: string;
  featured?: boolean;
  page?: number;
  limit?: number;
} = {}): Promise<ProductListResponse> {
  const search = new URLSearchParams();
  if (params.category) search.set("category", params.category);
  if (params.character) search.set("character", params.character);
  if (params.featured) search.set("featured", "true");
  if (params.page) search.set("page", String(params.page));
  if (params.limit) search.set("limit", String(params.limit));

  const qs = search.toString();

  try {
    return await apiFetch<ProductListResponse>(`/products${qs ? `?${qs}` : ""}`);
  } catch {
    return { items: [], total: 0, page: 1, pages: 0 };
  }
}

export async function getProductBySlug(slug: string): Promise<ProductDetailResponse | null> {
  try {
    return await apiFetch<ProductDetailResponse>(`/products/${slug}`);
  } catch {
    return null;
  }
}

// Sitemap generation needs every slug — a higher limit than the catalog UI uses.
export async function getAllProductsForSitemap(): Promise<Product[]> {
  try {
    const res = await apiFetch<ProductListResponse>("/products?limit=5000", 60 * 60);
    return res.items;
  } catch {
    return [];
  }
}
