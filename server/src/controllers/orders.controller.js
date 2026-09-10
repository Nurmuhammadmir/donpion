import asyncHandler from "express-async-handler";
import Order from "../models/Order.js";
import Product from "../models/Product.js";
import Customer from "../models/Customer.js";
import SiteSettings from "../models/SiteSettings.js";

// Short and readable on a receipt/SMS: two letters + four digits (e.g.
// FL-4821). No date stamp — retried on the rare collision instead.
function generateOrderNumber() {
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `FL-${rand}`;
}

async function createOrderWithUniqueNumber(data, attempts = 5) {
  for (let i = 0; i < attempts; i++) {
    try {
      return await Order.create({ ...data, orderNumber: generateOrderNumber() });
    } catch (err) {
      const isDuplicateOrderNumber = err.code === 11000 && err.keyPattern?.orderNumber;
      if (!isDuplicateOrderNumber || i === attempts - 1) throw err;
    }
  }
}

// POST /api/orders  (public — created from the checkout page)
export const createOrder = asyncHandler(async (req, res) => {
  const { customer, items, deliveryDate, deliveryTime, paymentMethod, location, redeemPoints } = req.body;

  if (!items || items.length === 0) {
    res.status(400);
    throw new Error("Order must contain at least one item");
  }

  const cleanLocation =
    location && Number.isFinite(location.lat) && Number.isFinite(location.lng)
      ? { lat: location.lat, lng: location.lng }
      : undefined;

  // Re-price server-side from the DB so a tampered client payload can't change totals.
  const productIds = items.map((i) => i.productId);
  const products = await Product.find({ _id: { $in: productIds } });
  const productMap = new Map(products.map((p) => [String(p._id), p]));

  let subtotal = 0;
  const orderItems = items.map((i) => {
    const product = productMap.get(String(i.productId));
    if (!product) {
      res.status(400);
      throw new Error(`Product ${i.productId} not found`);
    }
    const quantity = Math.max(1, Number(i.quantity) || 1);
    subtotal += product.price * quantity;
    return {
      product: product._id,
      name: product.name,
      slug: product.slug,
      image: product.images[0],
      price: product.price,
      quantity,
    };
  });

  // "Пионы" redemption — spent from the balance right away (atomically, so
  // two near-simultaneous orders from the same customer can't both spend
  // the same points) rather than merely reserved. Refunded automatically
  // if the order never actually gets created (below) or later gets
  // cancelled (see updateOrderStatus).
  let pointsRedeemed = 0;
  if (redeemPoints === true) {
    const desired = Math.min(req.customer.pointsBalance, subtotal);
    if (desired > 0) {
      const spent = await Customer.findOneAndUpdate(
        { _id: req.customer._id, pointsBalance: { $gte: desired } },
        { $inc: { pointsBalance: -desired } }
      );
      if (spent) pointsRedeemed = desired;
    }
  }

  const totalAmount = subtotal - pointsRedeemed;

  const settings = await SiteSettings.findOne({ key: "homepage" });
  const cashbackPercent = settings?.cashbackPercent ?? 0;
  // Earned on what's actually paid (post-discount), not the pre-discount
  // subtotal — rewards real spend instead of letting a redeemed discount
  // also inflate the next cashback.
  const pointsEarned = Math.floor((totalAmount * cashbackPercent) / 100);

  // Standalone MongoDB here (no replica set), so a real multi-document
  // transaction spanning the point debit above and the order write below
  // isn't available — a process crash in the narrow window between them
  // (not a catchable JS error, an actual process death) could in theory
  // leave points debited with no order and no catch block to refund them.
  // This log line is the mitigation: it makes that state greppable/visible
  // for manual reconciliation instead of silently vanishing. Move this to
  // a real session-based transaction if this ever runs against a replica
  // set (e.g. MongoDB Atlas) in production.
  if (pointsRedeemed > 0) {
    console.log(`[points] debited ${pointsRedeemed} from customer ${req.customer._id} — creating order now`);
  }

  let order;
  try {
    order = await createOrderWithUniqueNumber({
      customerId: req.customer._id,
      customer,
      location: cleanLocation,
      items: orderItems,
      deliveryDate,
      deliveryTime,
      paymentMethod,
      subtotal,
      pointsRedeemed,
      totalAmount,
      pointsEarned,
    });
  } catch (err) {
    // The order never actually got created — give back whatever points
    // were just spent above, or the customer loses them for nothing.
    if (pointsRedeemed > 0) {
      await Customer.findByIdAndUpdate(req.customer._id, { $inc: { pointsBalance: pointsRedeemed } });
      console.log(`[points] order creation failed — refunded ${pointsRedeemed} back to customer ${req.customer._id}`);
    }
    throw err;
  }

  res.status(201).json(order);
});

// GET /api/orders/mine  (customer — their own order history)
export const getMyOrders = asyncHandler(async (req, res) => {
  const orders = await Order.find({ customerId: req.customer._id }).sort({ createdAt: -1 });
  res.json(orders);
});

// GET /api/admin/orders  (admin)
export const getOrders = asyncHandler(async (req, res) => {
  const { status, page = 1, limit = 30 } = req.query;
  const filter = {};
  if (status) filter.status = status;

  const skip = (Number(page) - 1) * Number(limit);
  const [items, total] = await Promise.all([
    Order.find(filter).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)),
    Order.countDocuments(filter),
  ]);

  res.json({ items, total, page: Number(page), pages: Math.ceil(total / Number(limit)) });
});

// GET /api/admin/orders/:id  (admin)
export const getOrderById = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (!order) {
    res.status(404);
    throw new Error("Order not found");
  }
  res.json(order);
});

// PATCH /api/admin/orders/:id/status  (admin)
export const updateOrderStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;
  const order = await Order.findById(req.params.id);
  if (!order) {
    res.status(404);
    throw new Error("Order not found");
  }

  order.status = status;
  await order.save();

  // Cashback credit — fires once, the first time an order reaches
  // "completed". The findOneAndUpdate filter (pointsEarnedCredited: false)
  // is the atomicity guard: if the admin double-clicks or two requests
  // race, only one of them actually flips the flag, so only one credits
  // the customer. No replica set here, so this and the Customer update
  // below aren't in one transaction — the log line makes a crash in that
  // exact window (flag flipped, credit never applied) greppable instead of
  // silent; see the identical note in createOrder above.
  if (status === "completed" && order.pointsEarned > 0) {
    const claimed = await Order.findOneAndUpdate(
      { _id: order._id, pointsEarnedCredited: false },
      { $set: { pointsEarnedCredited: true } }
    );
    if (claimed) {
      console.log(`[points] crediting ${order.pointsEarned} to customer ${order.customerId} for completed order ${order.orderNumber}`);
      await Customer.findByIdAndUpdate(order.customerId, { $inc: { pointsBalance: order.pointsEarned } });
    }
  }

  // Refund of redeemed points — same one-shot guard, on the order's first
  // arrival at "cancelled".
  if (status === "cancelled" && order.pointsRedeemed > 0) {
    const claimed = await Order.findOneAndUpdate(
      { _id: order._id, pointsRedeemedRefunded: false },
      { $set: { pointsRedeemedRefunded: true } }
    );
    if (claimed) {
      console.log(`[points] refunding ${order.pointsRedeemed} to customer ${order.customerId} for cancelled order ${order.orderNumber}`);
      await Customer.findByIdAndUpdate(order.customerId, { $inc: { pointsBalance: order.pointsRedeemed } });
    }
  }

  const fresh = await Order.findById(order._id);
  res.json(fresh);
});
