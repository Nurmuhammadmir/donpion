import mongoose from "mongoose";

const orderItemSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
    name: { type: String, required: true },
    slug: { type: String, required: true },
    image: { type: String, required: true },
    price: { type: Number, required: true },
    quantity: { type: Number, required: true, min: 1 },
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    orderNumber: { type: String, required: true, unique: true },
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: "Customer" },
    customer: {
      name: { type: String, required: true },
      phone: { type: String, required: true },
      email: { type: String, default: "" },
      // Free-text address is optional — the map pin below is the source of
      // truth for where to deliver; this is only a human-readable label.
      address: { type: String, default: "" },
      city: { type: String, default: "Tashkent" },
      comment: { type: String, default: "" },
    },
    // Delivery pin the customer dropped on the checkout map (Mapbox) — lets
    // the admin open turn-by-turn directions straight from the order.
    location: {
      lat: { type: Number },
      lng: { type: Number },
    },
    items: { type: [orderItemSchema], required: true, validate: (v) => v.length > 0 },
    deliveryDate: { type: String, default: "" },
    deliveryTime: { type: String, default: "" },
    paymentMethod: {
      type: String,
      enum: ["cash", "card", "online"],
      default: "cash",
    },
    // Sum of items before any "Пионы" discount — totalAmount (what's
    // actually charged) is subtotal minus pointsRedeemed.
    subtotal: { type: Number, required: true, min: 0 },
    totalAmount: { type: Number, required: true, min: 0 },
    // "Пионы" cashback (see Customer.pointsBalance). Both amounts are
    // locked in at order-creation time — pointsRedeemed is spent from the
    // customer's balance immediately, pointsEarned is computed from that
    // era's cashback rate but only actually credited once the order
    // reaches "completed". The two *Credited/*Refunded flags are one-shot
    // guards so a status changed twice (or two racing requests) can never
    // double-credit or double-refund.
    pointsRedeemed: { type: Number, default: 0, min: 0 },
    pointsEarned: { type: Number, default: 0, min: 0 },
    pointsEarnedCredited: { type: Boolean, default: false },
    pointsRedeemedRefunded: { type: Boolean, default: false },
    // Warehouse stock — deducted once, right after the order is created
    // (see createOrder); restored once, the first time the order reaches
    // "cancelled" (see updateOrderStatus). Same one-shot-flag pattern as
    // the points fields above, for the same reason: a double status change
    // must never double-restore stock.
    stockDeducted: { type: Boolean, default: false },
    stockRestored: { type: Boolean, default: false },
    status: {
      type: String,
      enum: ["new", "confirmed", "delivering", "completed", "cancelled"],
      default: "new",
    },
  },
  { timestamps: true }
);

export default mongoose.models.Order || mongoose.model("Order", orderSchema);
