import mongoose from "mongoose";

// "Подписка на букеты" — a customer picks several future delivery dates
// up front (each with its own bouquet), instead of placing one order at a
// time. Deliberately its own top-level thing, not folded into Occasion's
// "Корпоративные заказы" (B2B bulk/custom orders for companies — a
// different audience and flow entirely).
//
// Each delivery is fulfilled by hand from the admin's "Подписки" page (no
// cron job in v1 — same "admin works a worklist" shape as Клиенты' "Скоро
// даты" widget), which deducts stock and applies the Касса balance the
// same way a real order would, without actually creating N separate Order
// documents. The one exception is a *prepaid* plan's upfront charge, which
// genuinely does need one real Order — Click/Payme's whole protocol keys
// off Order._id/paymentStatus, so reusing that unchanged (rather than
// teaching Click/Payme to also bill a Subscription) is the one real Order
// a subscription ever produces. See subscriptions.controller.js.
const deliverySchema = new mongoose.Schema(
  {
    date: { type: String, required: true }, // "YYYY-MM-DD"
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    // Snapshot at signup — same reasoning as Order.items: the product's
    // name/price can change later without rewriting history.
    name: { type: String, required: true },
    image: { type: String, required: true },
    price: { type: Number, required: true },
    status: {
      type: String,
      enum: ["scheduled", "delivered", "skipped", "cancelled"],
      default: "scheduled",
    },
    deliveredAt: { type: Date, default: null },
    deliveredBy: { type: String, default: "" },
  },
  { _id: false }
);

const subscriptionSchema = new mongoose.Schema(
  {
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: "Customer", required: true },
    customer: {
      name: { type: String, required: true },
      phone: { type: String, required: true },
    },
    fulfillmentMethod: { type: String, enum: ["delivery", "pickup"], default: "delivery" },
    // Delivery-only:
    address: { type: String, default: "" },
    location: {
      lat: { type: Number },
      lng: { type: Number },
    },
    // Pickup-only — snapshot, same reason Order.pickupBranch is one.
    pickupBranch: {
      branchId: { type: mongoose.Schema.Types.ObjectId, ref: "Branch" },
      name: { type: String },
      address: { type: String },
    },

    deliveries: { type: [deliverySchema], required: true, validate: (v) => v.length > 0 },

    // "Оплата сразу" (prepaid, one Click/Payme charge for the whole
    // package up front) vs. "оплата при получении" (pay_on_delivery —
    // cash/card collected in person each time, same as any pickup order;
    // only offered for pickup — a courier never collects cash, same rule
    // createOrder already enforces for ordinary orders).
    paymentPlan: { type: String, enum: ["prepaid", "pay_on_delivery"], required: true },
    paymentMethod: { type: String, enum: ["cash", "card", "online"], required: true },
    totalAmount: { type: Number, required: true, min: 0 },
    // Only set for paymentPlan "prepaid" — the one real Order Click/Payme
    // actually charges. Null while unpaid.
    paymentOrder: { type: mongoose.Schema.Types.ObjectId, ref: "Order", default: null },
    paid: { type: Boolean, default: false },

    status: { type: String, enum: ["pending_payment", "active", "completed", "cancelled"], default: "active" },
  },
  { timestamps: true }
);

subscriptionSchema.index({ customerId: 1, createdAt: -1 });
subscriptionSchema.index({ status: 1, "deliveries.date": 1 });

export default mongoose.models.Subscription || mongoose.model("Subscription", subscriptionSchema);
