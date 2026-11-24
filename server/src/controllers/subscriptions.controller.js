import asyncHandler from "express-async-handler";
import Subscription from "../models/Subscription.js";
import Order from "../models/Order.js";
import Product from "../models/Product.js";
import Branch from "../models/Branch.js";
import StockEntry from "../models/StockEntry.js";
import { deductFlowersForSale } from "../utils/bouquetStock.js";
import { loadPricingDefaults, buildItemCostSnapshot } from "../utils/bouquetPricing.js";
import { applySubscriptionDelivery } from "../utils/cashBalance.js";
import { sendTelegramMessage } from "../utils/telegramBot.js";

// Same two-letter-plus-digits shape as orders.controller.js's own
// generateOrderNumber — duplicated rather than imported so this file never
// has to touch orders.controller.js (that generator isn't exported, and
// re-exporting it is more risk to an already-working file than six
// duplicate lines here).
function generateOrderNumber() {
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `SB-${rand}`;
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

// POST /api/subscriptions  (customer)
// Body: { fulfillmentMethod, address?, location?, branchId? (pickup),
//         deliveries: [{ date, productId }], paymentPlan, paymentMethod? }
export const createSubscription = asyncHandler(async (req, res) => {
  const { address, location, branchId, paymentPlan } = req.body;
  const fulfillmentMethod = req.body.fulfillmentMethod === "pickup" ? "pickup" : "delivery";
  const deliveries = Array.isArray(req.body.deliveries) ? req.body.deliveries : [];

  if (deliveries.length === 0) {
    res.status(400);
    throw new Error("Выберите хотя бы одну дату доставки");
  }
  if (paymentPlan !== "prepaid" && paymentPlan !== "pay_on_delivery") {
    res.status(400);
    throw new Error("Укажите способ оплаты подписки");
  }
  // Same business rule as createOrder: no courier ever collects cash/card,
  // so paying per-delivery only makes sense for pickup.
  if (paymentPlan === "pay_on_delivery" && fulfillmentMethod !== "pickup") {
    res.status(400);
    throw new Error("Оплата при получении доступна только для самовывоза");
  }

  let pickupBranch;
  if (fulfillmentMethod === "pickup") {
    const branch = branchId ? await Branch.findOne({ _id: branchId, isActive: true }) : null;
    if (!branch) {
      res.status(400);
      throw new Error("Выберите пункт самовывоза");
    }
    pickupBranch = { branchId: branch._id, name: branch.name, address: branch.address };
  }

  const effectivePaymentMethod = paymentPlan === "prepaid" ? "online" : req.body.paymentMethod === "card" ? "card" : "cash";

  // Re-price from the DB, same anti-tampering reasoning as createOrder.
  const productIds = deliveries.map((d) => d.productId);
  const products = await Product.find({ _id: { $in: productIds }, isActive: true, priceConfirmed: { $ne: false } });
  const productMap = new Map(products.map((p) => [String(p._id), p]));
  const pricingSettings = await loadPricingDefaults();

  let totalAmount = 0;
  const deliveryDocs = deliveries.map((d) => {
    const product = productMap.get(String(d.productId));
    if (!product) {
      res.status(400);
      throw new Error(`Товар ${d.productId} не найден`);
    }
    if (!d.date || !/^\d{4}-\d{2}-\d{2}$/.test(d.date)) {
      res.status(400);
      throw new Error("Некорректная дата доставки");
    }
    totalAmount += product.price;
    return { date: d.date, product: product._id, name: product.name, image: product.images[0], price: product.price };
  });
  deliveryDocs.sort((a, b) => a.date.localeCompare(b.date));

  const subscription = await Subscription.create({
    customerId: req.customer._id,
    customer: { name: req.customer.name, phone: req.customer.phone },
    fulfillmentMethod,
    address: fulfillmentMethod === "delivery" ? address || "" : "",
    location: fulfillmentMethod === "delivery" && location?.lat && location?.lng ? location : undefined,
    pickupBranch,
    deliveries: deliveryDocs,
    paymentPlan,
    paymentMethod: effectivePaymentMethod,
    totalAmount,
    status: paymentPlan === "prepaid" ? "pending_payment" : "active",
  });

  let paymentOrder = null;
  if (paymentPlan === "prepaid") {
    const orderItems = deliveryDocs.map((d) => {
      const product = productMap.get(String(d.product));
      return {
        product: d.product,
        name: d.name,
        slug: product.slug,
        image: d.image,
        price: d.price,
        quantity: 1,
        costSnapshot: buildItemCostSnapshot(product, 1, pricingSettings),
      };
    });

    paymentOrder = await createOrderWithUniqueNumber({
      customerId: req.customer._id,
      customer: { name: req.customer.name, phone: req.customer.phone, address: address || "" },
      location: fulfillmentMethod === "delivery" && location?.lat && location?.lng ? location : undefined,
      items: orderItems,
      fulfillmentMethod,
      pickupBranch,
      branch: pickupBranch?.branchId ?? null,
      deliveryDate: deliveryDocs[0].date,
      paymentMethod: "online",
      subtotal: totalAmount,
      totalAmount,
      subscriptionPaymentFor: subscription._id,
    });
    subscription.paymentOrder = paymentOrder._id;
    await subscription.save();
  }

  const adminChatId = process.env.ADMIN_TELEGRAM_CHAT_ID;
  if (adminChatId) {
    const lines = [
      `📅 <b>Новая подписка на букеты</b>`,
      "",
      `Клиент: ${req.customer.name}`,
      `Телефон: ${req.customer.phone}`,
      `Доставок: ${deliveryDocs.length} (${deliveryDocs[0].date} — ${deliveryDocs[deliveryDocs.length - 1].date})`,
      `Оплата: ${paymentPlan === "prepaid" ? "сразу онлайн" : "при получении"}`,
      `Сумма: ${totalAmount.toLocaleString("ru-RU")} сум`,
    ];
    sendTelegramMessage(adminChatId, lines.join("\n"), { parseMode: "HTML" });
  }

  res.status(201).json({ subscription, paymentOrder });
});

// GET /api/subscriptions/mine  (customer)
export const getMySubscriptions = asyncHandler(async (req, res) => {
  const subscriptions = await Subscription.find({ customerId: req.customer._id }).sort({ createdAt: -1 });
  res.json(subscriptions);
});

// GET /api/subscriptions  (admin) — ?status=active
export const getSubscriptionsAdmin = asyncHandler(async (req, res) => {
  const { status } = req.query;
  const filter = {};
  if (status) filter.status = status;
  const subscriptions = await Subscription.find(filter).populate("pickupBranch.branchId", "name").sort({ createdAt: -1 });
  res.json(subscriptions);
});

// PATCH /api/subscriptions/:id/deliveries/:date/deliver  (admin)
// Body: { deliveredBy? }
export const markDeliveryDelivered = asyncHandler(async (req, res) => {
  const subscription = await Subscription.findById(req.params.id);
  if (!subscription) {
    res.status(404);
    throw new Error("Подписка не найдена");
  }
  if (subscription.paymentPlan === "prepaid" && !subscription.paid) {
    res.status(400);
    throw new Error("Подписка ещё не оплачена");
  }
  const delivery = subscription.deliveries.find((d) => d.date === req.params.date);
  if (!delivery) {
    res.status(404);
    throw new Error("Дата доставки не найдена");
  }
  if (delivery.status !== "scheduled") {
    res.status(400);
    throw new Error("Эта доставка уже обработана");
  }

  const product = await Product.findById(delivery.product);
  if (product) {
    const viaFlowers = await deductFlowersForSale(product, 1, { branch: subscription.pickupBranch?.branchId ?? null });
    if (!viaFlowers) {
      await Promise.all([
        Product.findByIdAndUpdate(product._id, { $inc: { stock: -1 } }),
        StockEntry.create({
          product: product._id,
          quantity: -1,
          reason: "sale",
          branch: subscription.pickupBranch?.branchId ?? null,
          unitCost: product.costPrice ?? 0,
          note: `Подписка — доставка ${delivery.date}`,
        }),
      ]);
    }
  }

  // Money changes hands right now only for "оплата при получении" — a
  // prepaid plan already settled the whole package up front.
  if (subscription.paymentPlan === "pay_on_delivery") {
    await applySubscriptionDelivery({
      paymentMethod: subscription.paymentMethod,
      branchId: subscription.pickupBranch?.branchId ?? null,
      amount: delivery.price,
      subscriptionId: subscription._id,
    });
  }

  delivery.status = "delivered";
  delivery.deliveredAt = new Date();
  delivery.deliveredBy = req.body.deliveredBy || "";

  if (subscription.deliveries.every((d) => d.status !== "scheduled")) {
    subscription.status = "completed";
  }
  await subscription.save();
  res.json(subscription);
});

// PATCH /api/subscriptions/:id/deliveries/:date/skip  (admin)
export const skipDelivery = asyncHandler(async (req, res) => {
  const subscription = await Subscription.findById(req.params.id);
  if (!subscription) {
    res.status(404);
    throw new Error("Подписка не найдена");
  }
  const delivery = subscription.deliveries.find((d) => d.date === req.params.date);
  if (!delivery || delivery.status !== "scheduled") {
    res.status(400);
    throw new Error("Эту доставку нельзя пропустить");
  }
  delivery.status = "skipped";
  if (subscription.deliveries.every((d) => d.status !== "scheduled")) {
    subscription.status = "completed";
  }
  await subscription.save();
  res.json(subscription);
});

// PATCH /api/subscriptions/:id/cancel  (admin) — cancels the whole
// subscription and every delivery still "scheduled". Doesn't touch
// anything already delivered/skipped, and doesn't auto-refund a prepaid
// balance — that's a deliberate manual judgment call for the owner.
export const cancelSubscription = asyncHandler(async (req, res) => {
  const subscription = await Subscription.findById(req.params.id);
  if (!subscription) {
    res.status(404);
    throw new Error("Подписка не найдена");
  }
  subscription.status = "cancelled";
  for (const d of subscription.deliveries) {
    if (d.status === "scheduled") d.status = "cancelled";
  }
  await subscription.save();
  res.json(subscription);
});
