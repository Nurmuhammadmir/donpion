export interface Branch {
  _id: string;
  name: string;
  address: string;
  phone: string;
  workingHours: string;
  isActive: boolean;
  isMain: boolean;
}

export type FlowerType = "flower" | "greenery" | "packaging" | "ribbon" | "basket";

export const FLOWER_TYPE_LABELS: Record<FlowerType, string> = {
  flower: "Цветок",
  greenery: "Зелень",
  packaging: "Упаковка",
  ribbon: "Лента",
  basket: "Корзина/коробка",
};

export interface Flower {
  _id: string;
  name: string;
  category: { _id: string; name: string } | string | null;
  type: FlowerType;
  stock: number;
  costPrice: number;
  unit: string;
  isActive: boolean;
}

export interface Product {
  _id: string;
  name: string;
  slug: string;
  kind: "bouquet" | "addon";
  price: number;
  stock: number;
  images: string[];
  isActive: boolean;
}

export interface WarehouseItem {
  _id: string;
  name: string;
  slug: string;
  category: { _id: string; name: string } | null;
  stock: number;
  costPrice: number;
  isActive: boolean;
  image: string;
  lowStock: boolean;
}

export interface WarehouseOverview {
  threshold: number;
  totalValue: number;
  items: WarehouseItem[];
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
    address?: string;
  };
  items: OrderItem[];
  source: "online" | "pos";
  totalAmount: number;
  status: "new" | "confirmed" | "delivering" | "completed" | "cancelled";
  createdAt: string;
}

export const ORDER_STATUS_LABELS: Record<Order["status"], string> = {
  new: "Новый",
  confirmed: "Подтверждён",
  delivering: "Доставляется",
  completed: "Завершён",
  cancelled: "Отменён",
};

// Лиды — заявки с сайта и из Instagram (server/src/models/Lead.js).
// Неподтверждённые заказы (status:"new") показываются на той же странице
// рядом, но это отдельный тип (см. Order выше) — не Lead.
export type LeadChannel = "site_form" | "instagram";
export type LeadStatus = "new" | "contacted" | "closed";

export interface LeadMessage {
  text: string;
  at: string;
}

export interface Lead {
  _id: string;
  channel: LeadChannel;
  name: string;
  phone: string;
  message: string;
  messages: LeadMessage[];
  instagramUserId: string;
  instagramUsername: string;
  status: LeadStatus;
  createdAt: string;
  updatedAt: string;
}

export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  new: "Новая",
  contacted: "Связались",
  closed: "Закрыта",
};

export const LEAD_CHANNEL_LABELS: Record<LeadChannel, string> = {
  site_form: "Сайт",
  instagram: "Instagram",
};
