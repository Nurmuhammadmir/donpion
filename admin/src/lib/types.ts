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
  cashBalance: number;
}

export interface SiteSettings {
  heroImage: string;
  heroImageTablet?: string | null;
  heroImageMobile?: string | null;
  cashbackPercent: number;
  lowStockThreshold: number;
}

// ТЗ 1.2 — bouquet pricing formula defaults. Kept off GET /settings (the
// public endpoint SiteSettings above describes) since these are the same
// kind of internal-only number as a product's own costPrice; fetched
// separately via the admin-only GET /settings/pricing.
export interface PricingSettings {
  assemblyPercent: number;
  markupMultiplier: number;
  deliveryFee: number;
}

// ТЗ 3.1 — catalog filters, a fixed list rather than an admin-managed
// taxonomy (see server/src/constants/catalogFilters.js for why).
export type Recipient = "mom" | "wife" | "girlfriend" | "colleague";
export const RECIPIENT_LABELS: Record<Recipient, string> = {
  mom: "Маме",
  wife: "Жене",
  girlfriend: "Девушке",
  colleague: "Коллеге",
};

export type BouquetColor = "red" | "white" | "pink" | "yellow" | "purple" | "orange" | "mixed";
export const COLOR_LABELS: Record<BouquetColor, string> = {
  red: "Красный",
  white: "Белый",
  pink: "Розовый",
  yellow: "Жёлтый",
  purple: "Фиолетовый",
  orange: "Оранжевый",
  mixed: "Микс",
};

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

export interface RecipeLine {
  flower: { _id: string; name: string; unit?: string } | string;
  quantity: number;
}

export interface PriceHistoryEntry {
  at: string;
  by: { _id: string; name: string } | string | null;
  recommendedPrice: number;
  finalPrice: number;
  diffPercent: number;
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
  recipients: Recipient[];
  colors: BouquetColor[];
  price: number;
  oldPrice: number | null;
  stock: number;
  costPrice: number;
  // ТЗ 1.2 — pricing formula inputs/state, admin-only (never in the
  // public API). The three overrides are null when the bouquet just uses
  // the current global SiteSettings default.
  packagingCost: number;
  ribbonCost: number;
  assemblyPercent: number | null;
  markupMultiplier: number | null;
  deliveryFee: number | null;
  priceConfirmed: boolean;
  priceHistory: PriceHistoryEntry[];
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
  isPreOrder: boolean;
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
  deliveryZone?: string;
  postcardText?: string;
  ribbonColor?: string;
  subtotal: number;
  totalAmount: number;
  pointsRedeemed: number;
  pointsEarned: number;
  status: "new" | "confirmed" | "delivering" | "completed" | "cancelled";
  paymentMethod: "cash" | "card" | "online";
  paymentStatus: "pending" | "paid" | "failed";
  // ТЗ 1.3 — set when a "под заказ" item here had no flowers on hand at
  // order time; procurementNote names which one(s).
  needsProcurement: boolean;
  procurementNote: string;
  // ТЗ 2.2 — кто собрал, фото готового букета (обязательно перед
  // "delivering" — see updateOrderStatus).
  assembledBy: string;
  assemblyPhoto: string;
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

export type WriteoffReason = "defect_on_receipt" | "wilted" | "broken" | "other";

export const WRITEOFF_REASON_LABELS: Record<WriteoffReason, string> = {
  defect_on_receipt: "Брак при приёмке",
  wilted: "Увяли",
  broken: "Сломались",
  other: "Другое",
};

export interface StockEntry {
  _id: string;
  product: { _id: string; name: string; slug: string } | null;
  flower: { _id: string; name: string; unit?: string } | null;
  quantity: number;
  reason: "receipt" | "sale" | "cancel_restock" | "adjustment" | "writeoff";
  writeoffReason?: WriteoffReason | null;
  photo?: string;
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
  writeoff: "Списание",
};

// ТЗ 2.3 — карточка клиента.
export interface ImportantDate {
  occasion: string;
  date: string; // "MM-DD"
  recipient: string;
}

export interface Customer {
  _id: string;
  name: string;
  phone: string;
  telegramChatId: string;
  pointsBalance: number;
  importantDates: ImportantDate[];
  createdAt: string;
}

export interface UpcomingDate {
  customerId: string;
  name: string;
  phone: string;
  occasion: string;
  recipient: string;
  date: string;
  inDays: number;
}

// ТЗ 2.1 — Отчет по списаниям за период в сумах.
export interface WriteoffReport {
  range: { from: string; to: string };
  total: number;
  byReason: Partial<Record<WriteoffReason, number>>;
  entries: StockEntry[];
}

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
  // True when at least one USD line/charge in this batch couldn't get a
  // same-day rate from the Central Bank and fell back to the last known
  // one — a flag to double-check it later, not a block on saving now.
  rateNeedsReview: boolean;
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

export type PaymentSource = "cash" | "bank";

export const PAYMENT_SOURCE_LABELS: Record<PaymentSource, string> = {
  cash: "Наличные (касса)",
  bank: "Безнал (счёт фирмы)",
};

export interface Expense {
  _id: string;
  branch: { _id: string; name: string } | string;
  category: ExpenseCategory;
  amount: number;
  paymentSource: PaymentSource;
  date: string;
  description: string;
  isRecurring: boolean;
  createdAt: string;
}

// "Касса" — real running balance, not a period report (see
// server/src/utils/cashBalance.js for how each number is kept up to date).
export interface BalanceSummary {
  branches: { _id: string; name: string; isActive: boolean; cashBalance: number }[];
  bankBalance: number;
  totalCash: number;
}

export type CashMovementReason = "order_payment" | "expense" | "transfer_to_bank" | "manual_adjustment";

export const CASH_MOVEMENT_REASON_LABELS: Record<CashMovementReason, string> = {
  order_payment: "Оплата заказа",
  expense: "Расход",
  transfer_to_bank: "Перевод в банк",
  manual_adjustment: "Коррекция",
};

export type SubscriptionDeliveryStatus = "scheduled" | "delivered" | "skipped" | "cancelled";

export interface SubscriptionDelivery {
  date: string;
  product: string;
  name: string;
  image: string;
  price: number;
  status: SubscriptionDeliveryStatus;
  deliveredAt: string | null;
  deliveredBy: string;
}

export type SubscriptionPaymentPlan = "prepaid" | "pay_on_delivery";
export type SubscriptionStatus = "pending_payment" | "active" | "completed" | "cancelled";

export interface Subscription {
  _id: string;
  customerId: string;
  customer: { name: string; phone: string };
  fulfillmentMethod: "delivery" | "pickup";
  address: string;
  location?: { lat: number; lng: number };
  pickupBranch?: { branchId: { _id: string; name: string } | string; name: string; address: string };
  deliveries: SubscriptionDelivery[];
  paymentPlan: SubscriptionPaymentPlan;
  paymentMethod: "cash" | "card" | "online";
  totalAmount: number;
  paymentOrder: string | null;
  paid: boolean;
  status: SubscriptionStatus;
  createdAt: string;
}

export const SUBSCRIPTION_STATUS_LABELS: Record<SubscriptionStatus, string> = {
  pending_payment: "Ждёт оплаты",
  active: "Активна",
  completed: "Завершена",
  cancelled: "Отменена",
};

export interface CashMovement {
  _id: string;
  bucket: "cash" | "bank";
  branch: { _id: string; name: string } | null;
  amount: number;
  balanceAfter: number;
  reason: CashMovementReason;
  order: { _id: string; orderNumber: string } | null;
  expense: { _id: string; category: ExpenseCategory; description: string } | null;
  subscription: { _id: string; customer: { name: string; phone: string } } | null;
  note: string;
  createdBy: { _id: string; name: string } | null;
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

// ТЗ 1.4 — margin report. Every bucket (totals/perOrder/byPeriod/byProduct/
// byBranch) shares this same shape.
export interface MarginBucket {
  revenue: number;
  purchaseTotal: number;
  assembly: number;
  deliveryFee: number;
  cost: number;
  margin: number;
  marginPercent: number;
  quantity: number;
  orderCount: number;
}

export interface MarginReport {
  range: { from: string; to: string };
  groupBy: "day" | "week" | "month";
  totals: MarginBucket;
  perOrder: (MarginBucket & { _id: string; orderNumber: string; createdAt: string; branch: string })[];
  byPeriod: (MarginBucket & { period: string })[];
  byProduct: (MarginBucket & { name: string })[];
  byBranch: (MarginBucket & { name: string })[];
}
