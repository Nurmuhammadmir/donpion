import asyncHandler from "express-async-handler";
import Order from "../models/Order.js";
import Product from "../models/Product.js";
import Customer from "../models/Customer.js";
import SiteSettings from "../models/SiteSettings.js";
import StockEntry from "../models/StockEntry.js";
import Branch from "../models/Branch.js";
import { sendTelegramMessage } from "../utils/telegramBot.js";
import { deductFlowersForSale, restoreFlowersForCancel } from "../utils/bouquetStock.js";
import { parseRange } from "../utils/dateRange.js";

const PAYMENT_METHOD_LABELS = { cash: "Наличными", card: "Картой", online: "Онлайн" };

function buildOrderAlertText(order) {
  const itemsText = order.items.map((i) => `• ${i.name} × ${i.quantity} — ${(i.price * i.quantity).toLocaleString("ru-RU")} сум`).join("\n");
  const lines = [
    `🛍 <b>Новый заказ ${order.orderNumber}</b>`,
    "",
    `Клиент: ${order.customer.name}`,
    `Телефон: ${order.customer.phone}`,
  ];
  if (order.fulfillmentMethod === "pickup") {
    if (order.pickupBranch?.name) lines.push(`Самовывоз: ${order.pickupBranch.name} (${order.pickupBranch.address})`);
  } else {
    if (order.customer.address) lines.push(`Адрес: ${order.customer.address}`);
    if (order.location?.lat && order.location?.lng) {
      lines.push(`Карта: https://www.google.com/maps?q=${order.location.lat},${order.location.lng}`);
    }
  }
  if (order.deliveryDate) {
    lines.push(`${order.fulfillmentMethod === "pickup" ? "Время самовывоза" : "Доставка"}: ${order.deliveryDate}${order.deliveryTime ? `, ${order.deliveryTime}` : ""}`);
  }
  lines.push(`Оплата: ${PAYMENT_METHOD_LABELS[order.paymentMethod] || order.paymentMethod}`);
  lines.push("", itemsText, "");
  lines.push(`Сумма заказа: ${order.subtotal.toLocaleString("ru-RU")} сум`);
  if (order.pointsRedeemed > 0) lines.push(`Списано Пионов: ${order.pointsRedeemed.toLocaleString("ru-RU")}`);
  lines.push(`К оплате: ${order.totalAmount.toLocaleString("ru-RU")} сум`);
  if (order.customer.comment) lines.push("", `Комментарий: ${order.customer.comment}`);
  return lines.join("\n");
}

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
  const { customer, items, deliveryDate, deliveryTime, paymentMethod, location, redeemPoints, branchId } = req.body;
  const fulfillmentMethod = req.body.fulfillmentMethod === "pickup" ? "pickup" : "delivery";

  if (!items || items.length === 0) {
    res.status(400);
    throw new Error("Order must contain at least one item");
  }

  // Which payment methods are even possible is dictated by fulfillment, not
  // customer choice — no courier ever collects cash/card, so delivery is
  // online-only; pickup is paid in person, so online doesn't apply there.
  // Enforced here rather than trusted from the client, same reason totals
  // are re-priced server-side below instead of trusting the cart payload.
  let pickupBranch;
  let effectivePaymentMethod;
  if (fulfillmentMethod === "pickup") {
    effectivePaymentMethod = paymentMethod === "card" ? "card" : "cash";
    const branch = branchId ? await Branch.findOne({ _id: branchId, isActive: true }) : null;
    if (!branch) {
      res.status(400);
      throw new Error("Выберите пункт самовывоза");
    }
    pickupBranch = { branchId: branch._id, name: branch.name, address: branch.address };
  } else {
    effectivePaymentMethod = "online";
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
      fulfillmentMethod,
      pickupBranch,
      // Online orders are attributed to the pickup branch when there is
      // one; delivery orders stay unattributed (null) since no single
      // branch fulfils them — see Order.branch.
      branch: pickupBranch?.branchId ?? null,
      deliveryDate,
      deliveryTime,
      paymentMethod: effectivePaymentMethod,
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

  // Pull stock the moment the order exists — a "new" order still holds the
  // flowers, same as confirmed/delivering, so reserving here (not only on
  // "completed") is what keeps the warehouse count honest. Not blocking on
  // insufficient stock: a florist can still fulfil a slight oversell by
  // hand, and stock going negative is a visible, correctable warehouse
  // signal rather than a lost sale. Same no-transaction caveat as the
  // points debit above: a crash between these writes and the stockDeducted
  // flag below would leave stock pulled but the flag unset, so a later
  // cancellation wouldn't know to restore it — this log line is the same
  // greppable mitigation used there.
  console.log(`[stock] deducting items for new order ${order.orderNumber}`);
  await Promise.all(
    orderItems.map(async (item) => {
      const product = productMap.get(String(item.product));
      // A bouquet with a recipe consumes its flowers instead of its own
      // stock (there's nothing of its own to deduct — see bouquetStock.js);
      // anything else (an addon, or a bouquet with no recipe yet) keeps
      // the original direct-stock behavior unchanged.
      const viaFlowers = product && (await deductFlowersForSale(product, item.quantity, { order, branch: order.branch }));
      if (!viaFlowers) {
        await Promise.all([
          Product.findByIdAndUpdate(item.product, { $inc: { stock: -item.quantity } }),
          StockEntry.create({
            product: item.product,
            quantity: -item.quantity,
            reason: "sale",
            order: order._id,
            branch: order.branch,
            unitCost: product?.costPrice ?? 0,
            note: `Заказ ${order.orderNumber}`,
          }),
        ]);
      }
    })
  );
  order.stockDeducted = true;
  await order.save();

  const adminChatId = process.env.ADMIN_TELEGRAM_CHAT_ID;
  if (adminChatId) {
    sendTelegramMessage(adminChatId, buildOrderAlertText(order), { parseMode: "HTML" });
  }

  res.status(201).json(order);
});

// GET /api/orders/mine  (customer — their own order history)
export const getMyOrders = asyncHandler(async (req, res) => {
  const orders = await Order.find({ customerId: req.customer._id }).sort({ createdAt: -1 });
  res.json(orders);
});

// POST /api/orders/pos  (admin) — a walk-in sale rung up in person at a
// branch till. Mirrors createOrder's re-pricing/stock-deduction above but
// skips the customer-OTP flow entirely (staff is already authenticated)
// and settles immediately: no "new → confirmed → delivering" pipeline,
// no online payment handshake, no Пионы redemption — a sale either
// happened at the register or it didn't.
export const createPosOrder = asyncHandler(async (req, res) => {
  const { items, paymentMethod, branchId, customerName, customerPhone } = req.body;

  if (!items || items.length === 0) {
    res.status(400);
    throw new Error("Добавьте хотя бы один товар");
  }
  if (!branchId) {
    res.status(400);
    throw new Error("Укажите филиал продажи");
  }
  const branch = await Branch.findById(branchId);
  if (!branch) {
    res.status(404);
    throw new Error("Филиал не найден");
  }

  const productIds = items.map((i) => i.productId);
  const products = await Product.find({ _id: { $in: productIds } });
  const productMap = new Map(products.map((p) => [String(p._id), p]));

  let subtotal = 0;
  const orderItems = items.map((i) => {
    const product = productMap.get(String(i.productId));
    if (!product) {
      res.status(400);
      throw new Error(`Товар ${i.productId} не найден`);
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

  // A phone number given at the register is the same customer every time
  // they come back — find-or-create by phone so POS sales build the same
  // customer base the storefront's own orders already do, instead of
  // every walk-in being a disconnected one-off.
  const trimmedPhone = customerPhone?.trim();
  let posCustomerId;
  if (trimmedPhone) {
    const customerRecord = await Customer.findOneAndUpdate(
      { phone: trimmedPhone },
      { $setOnInsert: { phone: trimmedPhone, name: customerName?.trim() || "Розничный покупатель" } },
      { upsert: true, new: true }
    );
    posCustomerId = customerRecord._id;
  }

  const order = await createOrderWithUniqueNumber({
    customerId: posCustomerId,
    customer: {
      name: customerName?.trim() || "Розничный покупатель",
      phone: trimmedPhone || "-",
      city: "Tashkent",
    },
    items: orderItems,
    fulfillmentMethod: "in_store",
    source: "pos",
    branch: branch._id,
    paymentMethod: paymentMethod === "card" ? "card" : "cash",
    paymentStatus: "paid",
    paidAt: new Date(),
    subtotal,
    totalAmount: subtotal,
    status: "completed",
  });

  console.log(`[stock] deducting items for POS sale ${order.orderNumber} at ${branch.name}`);
  await Promise.all(
    orderItems.map(async (item) => {
      const product = productMap.get(String(item.product));
      const viaFlowers = product && (await deductFlowersForSale(product, item.quantity, { order, branch: branch._id }));
      if (viaFlowers) return;
      await Promise.all([
        Product.findByIdAndUpdate(item.product, { $inc: { stock: -item.quantity } }),
        StockEntry.create({
          product: item.product,
          quantity: -item.quantity,
          reason: "sale",
          order: order._id,
          branch: branch._id,
          unitCost: product?.costPrice ?? 0,
          note: `Продажа ${order.orderNumber}`,
        }),
      ]);
    })
  );
  order.stockDeducted = true;
  await order.save();

  res.status(201).json(order);
});

// GET /api/admin/orders  (admin)
export const getOrders = asyncHandler(async (req, res) => {
  const { status, branch, source, excludeCancelled, page = 1, limit = 30 } = req.query;
  const filter = {};
  if (status) filter.status = status;
  else if (excludeCancelled === "true") filter.status = { $ne: "cancelled" };
  if (branch) filter.branch = branch;
  if (source) filter.source = source;
  if (req.query.from || req.query.to) {
    const { from, to } = parseRange(req.query);
    filter.createdAt = { $gte: from, $lte: to };
  }

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

  // Stock restore — same one-shot guard, on the order's first arrival at
  // "cancelled", and only if stock was actually pulled for it in the
  // first place (always true today, but guards against any order created
  // before this field existed).
  if (status === "cancelled" && order.stockDeducted) {
    const claimed = await Order.findOneAndUpdate(
      { _id: order._id, stockRestored: false },
      { $set: { stockRestored: true } }
    );
    if (claimed) {
      console.log(`[stock] restoring items for cancelled order ${order.orderNumber}`);
      const products = await Product.find({ _id: { $in: order.items.map((i) => i.product).filter(Boolean) } });
      const productMap = new Map(products.map((p) => [String(p._id), p]));
      await Promise.all(
        order.items.map(async (item) => {
          if (!item.product) return;
          const product = productMap.get(String(item.product));
          const viaFlowers = product && (await restoreFlowersForCancel(product, item.quantity, { order, branch: order.branch }));
          if (viaFlowers) return;
          await Promise.all([
            Product.findByIdAndUpdate(item.product, { $inc: { stock: item.quantity } }),
            StockEntry.create({
              product: item.product,
              quantity: item.quantity,
              reason: "cancel_restock",
              order: order._id,
              note: `Отмена заказа ${order.orderNumber}`,
            }),
          ]);
        })
      );
    }
  }

  const fresh = await Order.findById(order._id);
  res.json(fresh);
});

// GET /api/orders/stats  (admin) — small dashboard rollup: revenue over the
// last 30 days (excluding cancelled orders) and how many orders came in
// today. Aggregated server-side rather than shipping every order to the
// client just to sum a few numbers.
export const getOrderStats = asyncHandler(async (req, res) => {
  const { branch } = req.query;
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const branchFilter = branch ? { branch } : {};

  const [revenueAgg, ordersToday, todayAgg] = await Promise.all([
    Order.aggregate([
      { $match: { ...branchFilter, createdAt: { $gte: thirtyDaysAgo }, status: { $ne: "cancelled" } } },
      { $group: { _id: null, revenue: { $sum: "$totalAmount" }, count: { $sum: 1 } } },
    ]),
    Order.countDocuments({ ...branchFilter, createdAt: { $gte: startOfToday } }),
    Order.aggregate([
      { $match: { ...branchFilter, createdAt: { $gte: startOfToday }, status: { $ne: "cancelled" } } },
      { $group: { _id: null, revenue: { $sum: "$totalAmount" } } },
    ]),
  ]);

  res.json({
    revenue30d: revenueAgg[0]?.revenue ?? 0,
    orders30d: revenueAgg[0]?.count ?? 0,
    ordersToday,
    revenueToday: todayAgg[0]?.revenue ?? 0,
  });
});

// DELETE /api/orders  (admin) — one-time reset, not a routine action.
// Doesn't touch Customer records or any cashback balance already
// accrued — only the orders themselves and Финансы's "Поступления",
// which is sourced from them.
export const clearOrders = asyncHandler(async (req, res) => {
  const { deletedCount } = await Order.deleteMany({});
  res.json({ deletedCount });
});
