export interface Category {
  _id: string;
  name: string;
  slug: string;
  shortDescription: string;
  introText: string;
  seoTitle: string;
  seoDescription: string;
  image: string;
  sortOrder: number;
  isActive: boolean;
}

export interface CategoryRef {
  _id: string;
  name: string;
  slug: string;
}

export interface Character {
  _id: string;
  name: string;
  slug: string;
  description: string;
  sortOrder: number;
  isActive: boolean;
}

export interface AddonCategory {
  _id: string;
  name: string;
  slug: string;
  sortOrder: number;
  isActive: boolean;
}

export interface Occasion {
  _id: string;
  name: string;
  slug: string;
  description: string;
  sortOrder: number;
  isActive: boolean;
}

export interface Branch {
  _id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  phone: string;
  workingHours: string;
  isActive: boolean;
}

export interface SiteSettings {
  heroImage: string;
  heroImageTablet?: string | null;
  heroImageMobile?: string | null;
  cashbackPercent: number;
}

export interface Product {
  _id: string;
  name: string;
  slug: string;
  category: CategoryRef;
  addonCategories?: CategoryRef[];
  price: number;
  oldPrice: number | null;
  currency: string;
  stock: number;
  availability: "InStock" | "OutOfStock";
  images: string[];
  shortDescription: string;
  story: string;
  composition: string[];
  careInstructions: string;
  seoTitle: string;
  seoDescription: string;
  isFeatured: boolean;
  rating: number;
  reviewsCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ProductListResponse {
  items: Product[];
  total: number;
  page: number;
  pages: number;
}

// Minimal shape ProductCard needs — used both for full products and the
// lighter "related products" projection returned by the product-detail API.
export type ProductCardData = Pick<
  Product,
  "_id" | "name" | "slug" | "price" | "oldPrice" | "images" | "availability"
>;

export interface ProductDetailResponse {
  product: Product;
  related: ProductCardData[];
}

export interface CartLine {
  productId: string;
  slug: string;
  name: string;
  price: number;
  image: string;
  quantity: number;
}
