import Order from "../models/Order.js";
import { PAYME_ERROR, PAYME_ACCOUNT_FIELD, paymeMessage, checkPaymeAuth, somToTiyin } from "../utils/payme.js";
import { sendTelegramMessage } from "../utils/telegramBot.js";

// Same reason as click.controller.js's reply() helper: Payme calls this
// endpoint directly (Basic Auth, not a session) and requires HTTP 200 on
// every response — any other status is itself treated as a -32400 system
// error on Payme's side — so every branch replies through these two
// helpers instead of throwing to the regular errorHandler.
function reply(res, id, result) {
  const payload = { result, id };
  console.log("[payme] →", JSON.stringify(payload));
  res.json(payload);
}

function replyError(res, id, code, message, data) {
  const payload = { error: { code, message: paymeMessage(message), data }, id };
  console.log("[payme] →", JSON.stringify(payload));
  res.json(payload);
}

function stateOf(order) {
  if (order.paymentStatus === "paid") return 2;
  if (order.paymentStatus === "failed") return order.paymeCancelledAfterPaid ? -2 : -1;
  return 1;
}

async function checkPerformTransaction(res, params, id) {
  const amount = Number(params?.amount);
  const orderNumber = params?.account?.[PAYME_ACCOUNT_FIELD];
  if (!orderNumber) {
    return replyError(res, id, PAYME_ERROR.ACCOUNT_NOT_FOUND, "Order not found", { account: PAYME_ACCOUNT_FIELD });
  }

  const order = await Order.findOne({ orderNumber });
  if (!order) {
    return replyError(res, id, PAYME_ERROR.ACCOUNT_NOT_FOUND, "Order not found", { account: PAYME_ACCOUNT_FIELD });
  }
  if (order.paymentStatus === "paid") {
    return replyError(res, id, PAYME_ERROR.CANNOT_PERFORM, "Order already paid");
  }
  if (somToTiyin(order.totalAmount) !== amount) {
    return replyError(res, id, PAYME_ERROR.INVALID_AMOUNT, "Invalid amount");
  }

  reply(res, id, { allow: true });
}

// Must be retry-safe: Payme repeats CreateTransaction verbatim if it never
// received our response the first time, so a transaction id we've already
// recorded has to echo the original result, not error or recreate.
async function createTransaction(res, params, id) {
  const paymeId = params?.id;
  const amount = Number(params?.amount);
  const orderNumber = params?.account?.[PAYME_ACCOUNT_FIELD];

  if (!orderNumber) {
    return replyError(res, id, PAYME_ERROR.ACCOUNT_NOT_FOUND, "Order not found", { account: PAYME_ACCOUNT_FIELD });
  }
  const order = await Order.findOne({ orderNumber });
  if (!order) {
    return replyError(res, id, PAYME_ERROR.ACCOUNT_NOT_FOUND, "Order not found", { account: PAYME_ACCOUNT_FIELD });
  }

  if (order.paymeTransId === paymeId) {
    return reply(res, id, { create_time: order.paymeCreateTime, transaction: order._id.toString(), state: stateOf(order) });
  }
  // A different Payme transaction is already attached to this order — only
  // one may ever exist per order (mirrors Click's ALREADY_PAID-style guard).
  if (order.paymeTransId) {
    return replyError(res, id, PAYME_ERROR.CANNOT_PERFORM, "Order already has a transaction");
  }
  if (order.paymentStatus === "paid") {
    return replyError(res, id, PAYME_ERROR.CANNOT_PERFORM, "Order already paid");
  }
  if (somToTiyin(order.totalAmount) !== amount) {
    return replyError(res, id, PAYME_ERROR.INVALID_AMOUNT, "Invalid amount");
  }

  order.paymeTransId = paymeId;
  order.paymeCreateTime = Number(params.time) || Date.now();
  await order.save();

  reply(res, id, { create_time: order.paymeCreateTime, transaction: order._id.toString(), state: 1 });
}

async function performTransaction(res, params, id) {
  const order = await Order.findOne({ paymeTransId: params?.id });
  if (!order) return replyError(res, id, PAYME_ERROR.TRANSACTION_NOT_FOUND, "Transaction not found");

  if (order.paymentStatus === "paid") {
    return reply(res, id, { transaction: order._id.toString(), perform_time: order.paidAt?.getTime() ?? 0, state: 2 });
  }
  if (order.paymentStatus === "failed") {
    return replyError(res, id, PAYME_ERROR.CANNOT_PERFORM, "Transaction already cancelled");
  }

  order.paymentStatus = "paid";
  order.paidAt = new Date();
  await order.save();

  const adminChatId = process.env.ADMIN_TELEGRAM_CHAT_ID;
  if (adminChatId) {
    sendTelegramMessage(adminChatId, `💳 Оплата получена по заказу ${order.orderNumber} — ${order.totalAmount.toLocaleString("ru-RU")} сум (Payme)`, {
      parseMode: "HTML",
    });
  }

  reply(res, id, { transaction: order._id.toString(), perform_time: order.paidAt.getTime(), state: 2 });
}

async function cancelTransaction(res, params, id) {
  const order = await Order.findOne({ paymeTransId: params?.id });
  if (!order) return replyError(res, id, PAYME_ERROR.TRANSACTION_NOT_FOUND, "Transaction not found");

  // Already cancelled — echo the same result instead of cancelling twice.
  if (order.paymentStatus === "failed") {
    return reply(res, id, { transaction: order._id.toString(), cancel_time: order.paymeCancelTime, state: stateOf(order) });
  }
  // The order's already been fulfilled (flowers delivered) — Payme's own
  // error for exactly this case, since refunding now would mean giving the
  // flowers away for free rather than just reversing an unfulfilled charge.
  if (order.status === "completed") {
    return replyError(res, id, PAYME_ERROR.CANNOT_CANCEL_FULFILLED, "Order already fulfilled");
  }

  const wasPaid = order.paymentStatus === "paid";
  order.paymentStatus = "failed";
  order.paymeCancelledAfterPaid = wasPaid;
  order.paymeCancelTime = Date.now();
  order.paymeCancelReason = Number(params?.reason) || null;
  await order.save();

  reply(res, id, { transaction: order._id.toString(), cancel_time: order.paymeCancelTime, state: stateOf(order) });
}

async function checkTransaction(res, params, id) {
  const order = await Order.findOne({ paymeTransId: params?.id });
  if (!order) return replyError(res, id, PAYME_ERROR.TRANSACTION_NOT_FOUND, "Transaction not found");

  reply(res, id, {
    create_time: order.paymeCreateTime ?? 0,
    perform_time: order.paymentStatus === "paid" ? (order.paidAt?.getTime() ?? 0) : 0,
    cancel_time: order.paymeCancelTime ?? 0,
    transaction: order._id.toString(),
    state: stateOf(order),
    reason: order.paymeCancelReason ?? null,
  });
}

async function getStatement(res, params, id) {
  const from = Number(params?.from) || 0;
  const to = Number(params?.to) || Date.now();
  const orders = await Order.find({ paymeCreateTime: { $gte: from, $lte: to } }).sort({ paymeCreateTime: 1 });

  const transactions = orders.map((order) => ({
    id: order.paymeTransId,
    time: order.paymeCreateTime,
    amount: somToTiyin(order.totalAmount),
    account: { [PAYME_ACCOUNT_FIELD]: order.orderNumber },
    create_time: order.paymeCreateTime ?? 0,
    perform_time: order.paymentStatus === "paid" ? (order.paidAt?.getTime() ?? 0) : 0,
    cancel_time: order.paymeCancelTime ?? 0,
    transaction: order._id.toString(),
    state: stateOf(order),
    reason: order.paymeCancelReason ?? null,
  }));

  reply(res, id, { transactions });
}

// POST /api/payments/payme  (single JSON-RPC endpoint, method in the body)
export const paymeHandler = async (req, res) => {
  const { method, params, id } = req.body || {};
  console.log("[payme] ←", method, JSON.stringify(params));

  try {
    if (!checkPaymeAuth(req)) {
      return replyError(res, id, PAYME_ERROR.INSUFFICIENT_PRIVILEGE, "Insufficient privilege to perform this method");
    }

    switch (method) {
      case "CheckPerformTransaction":
        return await checkPerformTransaction(res, params, id);
      case "CreateTransaction":
        return await createTransaction(res, params, id);
      case "PerformTransaction":
        return await performTransaction(res, params, id);
      case "CancelTransaction":
        return await cancelTransaction(res, params, id);
      case "CheckTransaction":
        return await checkTransaction(res, params, id);
      case "GetStatement":
        return await getStatement(res, params, id);
      default:
        return replyError(res, id, PAYME_ERROR.METHOD_NOT_FOUND, "Method not found", method);
    }
  } catch (err) {
    console.error("[payme] handler failed:", err);
    return replyError(res, id, PAYME_ERROR.SYSTEM_ERROR, "Internal error");
  }
};
