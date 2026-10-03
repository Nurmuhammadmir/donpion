import Order from "../models/Order.js";
import { buildClickSignString, CLICK_ERROR, CLICK_ERROR_NOTE } from "../utils/click.js";
import { sendTelegramMessage } from "../utils/telegramBot.js";

// Click calls these two endpoints directly (no session/JWT — the sign_string
// check below IS the auth) and always expects HTTP 200 with this JSON shape,
// never a 4xx/5xx, so every branch replies through this helper instead of
// throwing to the regular errorHandler.
function reply(res, extra, error, note) {
  res.json({ ...extra, error, error_note: note ?? CLICK_ERROR_NOTE[error] });
}

const REQUIRED_FIELDS = ["click_trans_id", "service_id", "merchant_trans_id", "amount", "action", "sign_time", "sign_string"];

function isMalformed(body, { requirePrepareId }) {
  if (REQUIRED_FIELDS.some((field) => body[field] === undefined || body[field] === null)) return true;
  if (requirePrepareId && (body.merchant_prepare_id === undefined || body.merchant_prepare_id === null)) return true;
  return false;
}

// POST /api/payments/click/prepare  (action=0 — Click asking "can this order be paid?")
export const clickPrepare = async (req, res) => {
  try {
    const b = req.body;
    if (isMalformed(b, { requirePrepareId: false })) return reply(res, {}, CLICK_ERROR.BAD_REQUEST);

    const base = { click_trans_id: b.click_trans_id, merchant_trans_id: b.merchant_trans_id };

    const expectedSign = buildClickSignString({
      clickTransId: b.click_trans_id,
      serviceId: b.service_id,
      secretKey: process.env.CLICK_SECRET_KEY,
      merchantTransId: b.merchant_trans_id,
      amount: b.amount,
      action: b.action,
      signTime: b.sign_time,
    });
    if (expectedSign !== b.sign_string) return reply(res, base, CLICK_ERROR.SIGN_FAILED);
    if (String(b.action) !== "0") return reply(res, base, CLICK_ERROR.ACTION_NOT_FOUND);

    // transaction_param on the payment link is the order's human-readable
    // orderNumber (see CheckoutForm's Click redirect), not the Mongo _id.
    const order = await Order.findOne({ orderNumber: b.merchant_trans_id });
    if (!order) return reply(res, base, CLICK_ERROR.ORDER_NOT_FOUND);
    if (order.paymentStatus === "paid") return reply(res, base, CLICK_ERROR.ALREADY_PAID);
    if (Math.abs(order.totalAmount - Number(b.amount)) > 0.01) return reply(res, base, CLICK_ERROR.AMOUNT_MISMATCH);

    order.clickTransId = String(b.click_trans_id);
    await order.save();

    // merchant_prepare_id is our own reference Click hands back unchanged on
    // the later Complete call — the order's _id, so Complete can look it up
    // directly regardless of merchant_trans_id (kept human-readable above).
    reply(res, { ...base, merchant_prepare_id: order._id.toString() }, CLICK_ERROR.SUCCESS);
  } catch (err) {
    console.error("[click] prepare failed:", err);
    reply(res, {}, CLICK_ERROR.BAD_REQUEST, "Internal error");
  }
};

// POST /api/payments/click/complete  (action=1 — Click confirming the charge went through)
export const clickComplete = async (req, res) => {
  try {
    const b = req.body;
    if (isMalformed(b, { requirePrepareId: true })) return reply(res, {}, CLICK_ERROR.BAD_REQUEST);

    const base = {
      click_trans_id: b.click_trans_id,
      merchant_trans_id: b.merchant_trans_id,
      merchant_confirm_id: b.merchant_prepare_id,
    };

    const expectedSign = buildClickSignString({
      clickTransId: b.click_trans_id,
      serviceId: b.service_id,
      secretKey: process.env.CLICK_SECRET_KEY,
      merchantTransId: b.merchant_trans_id,
      merchantPrepareId: b.merchant_prepare_id,
      amount: b.amount,
      action: b.action,
      signTime: b.sign_time,
    });
    if (expectedSign !== b.sign_string) return reply(res, base, CLICK_ERROR.SIGN_FAILED);
    if (String(b.action) !== "1") return reply(res, base, CLICK_ERROR.ACTION_NOT_FOUND);

    const order = await Order.findById(b.merchant_prepare_id).catch(() => null);
    if (!order) return reply(res, base, CLICK_ERROR.TRANSACTION_NOT_FOUND);

    // Click reports a failed/cancelled charge (declined card, user backed
    // out, etc.) via a negative `error` on the Complete call itself, not
    // just a bad signature — record it and acknowledge, don't mark it paid.
    if (Number(b.error) < 0) {
      if (order.paymentStatus !== "paid") {
        order.paymentStatus = "failed";
        await order.save();
      }
      return reply(res, base, CLICK_ERROR.TRANSACTION_CANCELLED);
    }

    if (order.paymentStatus === "paid") return reply(res, base, CLICK_ERROR.ALREADY_PAID);
    if (Math.abs(order.totalAmount - Number(b.amount)) > 0.01) return reply(res, base, CLICK_ERROR.AMOUNT_MISMATCH);

    order.paymentStatus = "paid";
    order.paidAt = new Date();
    await order.save();

    const adminChatId = process.env.ADMIN_TELEGRAM_CHAT_ID;
    if (adminChatId) {
      sendTelegramMessage(adminChatId, `💳 Оплата получена по заказу ${order.orderNumber} — ${order.totalAmount.toLocaleString("ru-RU")} сум`, {
        parseMode: "HTML",
      });
    }

    reply(res, base, CLICK_ERROR.SUCCESS);
  } catch (err) {
    console.error("[click] complete failed:", err);
    reply(res, {}, CLICK_ERROR.BAD_REQUEST, "Internal error");
  }
};
