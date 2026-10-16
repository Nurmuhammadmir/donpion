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
    // Only meaningful when paymentMethod is "online" — tracks the Click Shop
    // API Prepare/Complete handshake (see routes/click.routes.js). Order
    // fulfilment (status above) still advances immediately on creation like
    // cash/card orders; this is purely the payment-confirmation record.
    paymentStatus: {
      type: String,
      enum: ["pending", "paid", "failed"],
      default: "pending",
    },
    // click_trans_id Click assigned this payment at Prepare time — kept for
    // support/reconciliation lookups in the Click merchant cabinet.
    clickTransId: { type: String, default: "" },
    paidAt: { type: Date },
    totalAmount: { type: Number, required: true, min: 0 },
    // Warehouse stock — deducted once, right after the order is created
    // (see createOrder); restored once, the first time the order reaches
    // "cancelled" (see updateOrderStatus). The flags are a one-shot guard:
    // a double status change must never double-restore stock.
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
