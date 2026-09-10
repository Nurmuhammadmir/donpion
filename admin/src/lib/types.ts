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

export interface Character {
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
  category: { _id: string; name: string; slug: string };
  characters: { _id: string; name: string; slug: string }[];
  price: number;
  oldPrice: number | null;
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
  isActive: boolean;
  rating: number;
  reviewsCount: number;
}

export interface OrderItem {
  name: string;
  slug: string;
  image: string;
  price: number;
  quantity: number;
}

export interface Order {
  _id: string;
  orderNumber: string;
  customer: {
    name: string;
    phone: string;
    email?: string;
    address?: string;
    city?: string;
    comment?: string;
  };
  items: OrderItem[];
  location?: { lat: number; lng: number };
  deliveryDate?: string;
  deliveryTime?: string;
  subtotal: number;
  totalAmount: number;
  pointsRedeemed: number;
  pointsEarned: number;
  status: "new" | "confirmed" | "delivering" | "completed" | "cancelled";
  paymentMethod: string;
  createdAt: string;
}

export const ORDER_STATUS_LABELS: Record<Order["status"], string> = {
  new: "Новый",
  confirmed: "Подтверждён",
  delivering: "Доставляется",
  completed: "Завершён",
  cancelled: "Отменён",
};
