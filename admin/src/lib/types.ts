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

export interface AddonCategory {
  _id: string;
  name: string;
  slug: string;
  image: string;
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
  isMain: boolean;
}

export interface SiteSettings {
  heroImage: string;
  heroImageTablet?: string | null;
  heroImageMobile?: string | null;
  cashbackPercent: number;
  lowStockThreshold: number;
}

export interface Flower {
  _id: string;
  name: string;
  category: { _id: string; name: string } | string;
  stock: number;
  costPrice: number;
  unit: string;
  isActive: boolean;
}

export interface RecipeLine {
  flower: { _id: string; name: string; unit?: string } | string;
  quantity: number;
}

export interface Product {
  _id: string;
  name: string;
  slug: string;
  // "bouquet": category/characters/costPrice/stock/isFeatured are all
  // derived automatically from `recipe` — nothing here is admin-entered.
  // "addon" (vase/chocolate/toy/certificate): works like before, direct
  // manual stock, no recipe.
  kind: "bouquet" | "addon";
  recipe: RecipeLine[];
  category: { _id: string; name: string; slug: string };
  characters: { _id: string; name: string; slug: string }[];
  addonCategories: { _id: string; name: string; slug: string }[];
  occasions: { _id: string; name: string; slug: string }[];
  price: number;
  oldPrice: number | null;
  stock: number;
  costPrice: number;
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
  fulfillmentMethod?: "delivery" | "pickup" | "in_store";
  pickupBranch?: { branchId?: string; name?: string; address?: string };
  // "online" = placed on the storefront; "pos" = rung up by staff at a
  // till — see createPosOrder in orders.controller.js.
  source: "online" | "pos";
  branch?: string | { _id: string; name: string } | null;
  deliveryDate?: string;
  deliveryTime?: string;
  subtotal: number;
  totalAmount: number;
  pointsRedeemed: number;
  pointsEarned: number;
  status: "new" | "confirmed" | "delivering" | "completed" | "cancelled";
  paymentMethod: "cash" | "card" | "online";
  paymentStatus: "pending" | "paid" | "failed";
  createdAt: string;
}

export const ORDER_SOURCE_LABELS: Record<Order["source"], string> = {
  online: "Сайт",
  pos: "Магазин",
};

export const PAYMENT_METHOD_LABELS: Record<Order["paymentMethod"], string> = {
  cash: "Наличными",
  card: "Картой",
  online: "Онлайн (Click)",
};

export const PAYMENT_STATUS_LABELS: Record<Order["paymentStatus"], string> = {
  pending: "Ожидает оплаты",
  paid: "Оплачено",
  failed: "Не прошла",
};

export const ORDER_STATUS_LABELS: Record<Order["status"], string> = {
  new: "Новый",
  confirmed: "Подтверждён",
  delivering: "Доставляется",
  completed: "Завершён",
  cancelled: "Отменён",
};

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

export interface StockEntry {
  _id: string;
  product: { _id: string; name: string; slug: string } | null;
  flower: { _id: string; name: string; unit?: string } | null;
  quantity: number;
  reason: "receipt" | "sale" | "cancel_restock" | "adjustment";
  note: string;
  branch?: string | { _id: string; name: string } | null;
  batch?: string | null;
  unitCost?: number | null;
  createdAt: string;
}

export const STOCK_REASON_LABELS: Record<StockEntry["reason"], string> = {
  receipt: "Приход",
  sale: "Продажа",
  cancel_restock: "Возврат (отмена заказа)",
  adjustment: "Корректировка",
};

export interface OrderStats {
  revenue30d: number;
  orders30d: number;
  ordersToday: number;
  revenueToday: number;
}

// ---- Поставщики и партии закупки ---------------------------------------

export interface Supplier {
  _id: string;
  name: string;
  country: string;
  contactPerson: string;
  phone: string;
  notes: string;
  isActive: boolean;
}

export interface PurchaseBatchItem {
  flower: { _id: string; name: string; unit?: string } | string;
  quantity: number;
  unitCost: number;
  currency: "UZS" | "USD";
  exchangeRate: number;
}

export interface PurchaseBatch {
  _id: string;
  branch: { _id: string; name: string } | string;
  supplier: { _id: string; name: string; country: string } | string | null;
  invoiceNumber: string;
  date: string;
  items: PurchaseBatchItem[];
  totalCostUZS: number;
  notes: string;
  createdAt: string;
}

// ---- Расходы и финансы ---------------------------------------------------

export type ExpenseCategory = "packaging" | "salary" | "rent" | "utilities" | "marketing" | "delivery" | "other";

export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  packaging: "Упаковка (коробки, лента)",
  salary: "Зарплата (флорист и т.п.)",
  rent: "Аренда",
  utilities: "Коммунальные услуги",
  marketing: "Маркетинг",
  delivery: "Доставка",
  other: "Другое",
};

export interface Expense {
  _id: string;
  branch: { _id: string; name: string } | string;
  category: ExpenseCategory;
  amount: number;
  date: string;
  description: string;
  isRecurring: boolean;
  createdAt: string;
}

export interface FinanceSummary {
  range: { from: string; to: string };
  revenue: number;
  orderCount: number;
  cogs: number;
  grossProfit: number;
  expensesByCategory: Partial<Record<ExpenseCategory, number>>;
  expensesTotal: number;
  netProfit: number;
  inventoryValue: number;
}
