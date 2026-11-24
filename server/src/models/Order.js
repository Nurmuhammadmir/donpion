import mongoose from "mongoose";

const orderItemSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
    name: { type: String, required: true },
    slug: { type: String, required: true },
    image: { type: String, required: true },
    price: { type: Number, required: true },
    quantity: { type: Number, required: true, min: 1 },
    // Snapshot of this item's own cost breakdown at the moment of sale
    // (ТЗ 1.4: "в каждом заказе сохраняется снимок себестоимости... цены
    // склада потом меняются") — already scaled by quantity, so a margin
    // report just sums these rather than recomputing from (possibly since-
    // changed) product/flower data. Margin itself = price×quantity minus
    // these three. Zero/zero for an addon (no сборка/доставка concept).
    costSnapshot: {
      purchaseTotal: { type: Number, default: 0 },
      assembly: { type: Number, default: 0 },
      deliveryFee: { type: Number, default: 0 },
    },
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    orderNumber: { type: String, required: true, unique: true },
    // Short public code for the "Вам дарят..." gift-reveal page
    // (/gift/[code] — see getOrderByGiftCode) — only ever generated for a
    // real checkout order (not POS, where "forward this to someone else"
    // doesn't apply). sparse so every order created before this field
    // existed (all missing it) doesn't collide against the unique index.
    giftCode: { type: String, unique: true, sparse: true },
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
    // How the customer gets the flowers — drives which payment methods are
    // even allowed (see orders.controller.js): "delivery" is online-only
    // (no courier ever collects cash/card), "pickup" is cash/card paid in
    // person at the branch below.
    fulfillmentMethod: {
      type: String,
      enum: ["delivery", "pickup", "in_store"],
      default: "delivery",
    },
    // "online" = placed by a customer on the storefront (delivery/pickup);
    // "pos" = rung up by staff at the register for a walk-in buyer — see
    // createPosOrder in orders.controller.js. Lets Finance/Dashboard split
    // website sales from physical-shop sales without inferring it from
    // fulfillmentMethod.
    source: { type: String, enum: ["online", "pos"], default: "online" },
    // Which physical branch this sale is attributed to — the pickup branch
    // for pickup orders, the till's branch for POS sales, null for online
    // delivery (not tied to one location). Drives the CEO branch switcher's
    // per-branch order/finance views.
    branch: { type: mongoose.Schema.Types.ObjectId, ref: "Branch", default: null },
    deliveryDate: { type: String, default: "" },
    deliveryTime: { type: String, default: "" },
    // Район Ташкента (ТЗ 3.2) — informational, for the florist/courier to
    // plan the route; delivery itself stays free for the customer either
    // way (the cost already sits inside the bouquet's own price, see 1.2).
    deliveryZone: { type: String, default: "" },
    // Открытка и лента (ТЗ 3.3) — customer-entered, shown to the florist
    // assembling the order; ribbonColor is a small fixed list of what
    // DonPion actually stocks ribbon in, not a free-text color name.
    postcardText: { type: String, default: "", maxlength: 300 },
    ribbonColor: { type: String, enum: ["red", "white", "pink", "gold", "black", ""], default: "" },
    // Only set when fulfillmentMethod is "pickup" — snapshot of the Branch
    // at order time (name/address), same denormalization reason as
    // orderItemSchema above: still reads correctly if the branch is later
    // renamed, moved, or deactivated.
    pickupBranch: {
      branchId: { type: mongoose.Schema.Types.ObjectId, ref: "Branch" },
      name: { type: String },
      address: { type: String },
    },
    // "cash"/"card" now mean paid in person at pickup; "online" means paid
    // through Click before a delivery order ships — see fulfillmentMethod.
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
    // Payme's own transaction id (params.id on every Merchant API call) —
    // every call after CreateTransaction identifies the transaction by this,
    // not by orderNumber, so it's the lookup key for Perform/Cancel/Check
    // (see controllers/payme.controller.js). paymentStatus/paidAt above are
    // shared with Click; these four are Payme-specific state Payme's own
    // protocol requires the merchant to echo back consistently on retries.
    paymeTransId: { type: String, default: "" },
    paymeCreateTime: { type: Number },
    paymeCancelTime: { type: Number },
    paymeCancelReason: { type: Number },
    // Which Payme state (-1 vs -2) a cancelled transaction keeps reporting —
    // paymentStatus alone can't tell "cancelled before payment" from
    // "cancelled after payment" once both have become "failed".
    paymeCancelledAfterPaid: { type: Boolean, default: false },
    paidAt: { type: Date },
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
    // Same one-shot-flag pattern, for Branch.cashBalance/SiteSettings.
    // bankBalance (see utils/cashBalance.js) — applied once money for this
    // order is actually in hand (cash/card reaching "completed", or online
    // payment confirming via Click/Payme), reversed once if it's then
    // cancelled.
    cashBalanceApplied: { type: Boolean, default: false },
    cashBalanceReversed: { type: Boolean, default: false },
    // Set when this order included a "под заказ" bouquet that had no
    // flowers on hand at order time (ТЗ 1.3: "заказ создаёт задачу на
    // закупку") — a visible flag for the florist to go source flowers for,
    // not a blocker on the order itself.
    needsProcurement: { type: Boolean, default: false },
    procurementNote: { type: String, default: "" },
    // "Готовый букет в заказе" (ТЗ 2.2) — who physically assembled it, and
    // a photo of the finished bouquet. assemblyPhoto is required before the
    // order can move to "delivering" ("Передан курьеру" — see
    // updateOrderStatus) and can be sent to the customer's Telegram chat
    // with one click from the admin Orders page.
    assembledBy: { type: String, default: "" },
    assemblyPhoto: { type: String, default: "" },
    status: {
      type: String,
      enum: ["new", "confirmed", "delivering", "completed", "cancelled"],
      default: "new",
    },
    // Set only on the one Order a *prepaid* Subscription charges up front
    // (see models/Subscription.js) — lets the Click/Payme "paid" webhooks
    // flip that Subscription's own paid/status after marking this order
    // paid, without teaching Click/Payme anything new about subscriptions.
    subscriptionPaymentFor: { type: mongoose.Schema.Types.ObjectId, ref: "Subscription", default: null },
  },
  { timestamps: true }
);

export default mongoose.models.Order || mongoose.model("Order", orderSchema);
