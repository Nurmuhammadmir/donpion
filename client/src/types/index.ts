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
  image?: string;
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

export type Recipient = "mom" | "wife" | "girlfriend" | "colleague";
export type BouquetColor = "red" | "white" | "pink" | "yellow" | "purple" | "orange" | "mixed";

export interface Product {
  _id: string;
  name: string;
  slug: string;
  category: CategoryRef;
  addonCategories?: CategoryRef[];
  recipients?: Recipient[];
  colors?: BouquetColor[];
  price: number;
  oldPrice: number | null;
  currency: string;
  stock: number;
  availability: "InStock" | "OutOfStock" | "PreOrder";
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

export type SubscriptionDeliveryStatus = "scheduled" | "delivered" | "skipped" | "cancelled";

export interface SubscriptionDelivery {
  date: string;
  product: string;
  name: string;
  image: string;
  price: number;
  status: SubscriptionDeliveryStatus;
}

export type SubscriptionPaymentPlan = "prepaid" | "pay_on_delivery";
export type SubscriptionStatus = "pending_payment" | "active" | "completed" | "cancelled";

export interface Subscription {
  _id: string;
  fulfillmentMethod: "delivery" | "pickup";
  address: string;
  pickupBranch?: { name: string; address: string };
  deliveries: SubscriptionDelivery[];
  paymentPlan: SubscriptionPaymentPlan;
  totalAmount: number;
  paid: boolean;
  status: SubscriptionStatus;
  createdAt: string;
}

export interface CreateSubscriptionResponse {
  subscription: Subscription;
  paymentOrder: { orderNumber: string; totalAmount: number } | null;
}

// GET /api/orders/gift/:code — deliberately NOT the raw order: see
// getOrderByGiftCode's own comment on why (address/phone/price/payment
// must never reach a link that can be forwarded).
export interface GiftOrder {
  bouquetName: string;
  bouquetImage: string;
  postcardText: string;
  ribbonColor: string;
  deliveryDate: string;
  deliveryTime: string;
  fulfillmentMethod: "delivery" | "pickup" | "in_store";
  senderName: string;
  status: string;
}
