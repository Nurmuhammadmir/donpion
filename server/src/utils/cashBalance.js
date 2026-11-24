import Branch from "../models/Branch.js";
import SiteSettings from "../models/SiteSettings.js";
import CashMovement from "../models/CashMovement.js";

// Every change to a balance goes through here so it's always paired with a
// CashMovement entry — the two can never drift apart. "bank" is one shared
// SiteSettings field regardless of branchId; "cash" is a specific Branch's
// till, so branchId is required for it.
async function moveBucket({ bucket, branchId, amount, reason, order, expense, subscription, note, createdBy }) {
  let balanceAfter;
  if (bucket === "cash") {
    const branch = await Branch.findByIdAndUpdate(branchId, { $inc: { cashBalance: amount } }, { new: true });
    if (!branch) throw new Error("Филиал не найден");
    balanceAfter = branch.cashBalance;
  } else {
    const settings = await SiteSettings.findOneAndUpdate(
      { key: "homepage" },
      { $inc: { bankBalance: amount } },
      { new: true, upsert: true }
    );
    balanceAfter = settings.bankBalance;
  }
  await CashMovement.create({
    bucket,
    branch: bucket === "cash" ? branchId : null,
    amount,
    balanceAfter,
    reason,
    order: order ?? null,
    expense: expense ?? null,
    subscription: subscription ?? null,
    note: note ?? "",
    createdBy: createdBy ?? null,
  });
  return balanceAfter;
}

// Money for this order is actually in hand: a cash/card sale reaching
// "completed" (POS sales are created completed already), or an online
// order's Click/Payme payment just confirming. Callers guard the one-shot
// flag themselves (same findOneAndUpdate(cashBalanceApplied:false) pattern
// as stockDeducted elsewhere) — this function doesn't check it.
export async function applyOrderPayment(order) {
  if (order.paymentMethod === "online") {
    await moveBucket({ bucket: "bank", amount: order.totalAmount, reason: "order_payment", order: order._id });
  } else if (order.paymentMethod === "card") {
    await moveBucket({ bucket: "bank", amount: order.totalAmount, reason: "order_payment", order: order._id });
  } else if (order.branch) {
    // A cash sale with no branch shouldn't exist (POS/pickup always set
    // one) — skip rather than throw if it somehow does, so a data
    // oddity on one order can't block the status update around this call.
    await moveBucket({ bucket: "cash", branchId: order.branch, amount: order.totalAmount, reason: "order_payment", order: order._id });
  }
}

export async function reverseOrderPayment(order) {
  if (order.paymentMethod === "online") {
    await moveBucket({ bucket: "bank", amount: -order.totalAmount, reason: "order_payment", order: order._id, note: "Отмена заказа" });
  } else if (order.paymentMethod === "card") {
    await moveBucket({ bucket: "bank", amount: -order.totalAmount, reason: "order_payment", order: order._id, note: "Отмена заказа" });
  } else if (order.branch) {
    await moveBucket({ bucket: "cash", branchId: order.branch, amount: -order.totalAmount, reason: "order_payment", order: order._id, note: "Отмена заказа" });
  }
}

// A "pay on delivery" Subscription delivery, collected in person the
// moment it's marked delivered (see subscriptions.controller.js) — same
// shape as applyOrderPayment, but logged against the Subscription instead
// of a (nonexistent, for this payment plan) Order.
export async function applySubscriptionDelivery({ paymentMethod, branchId, amount, subscriptionId }) {
  if (paymentMethod === "online") {
    await moveBucket({ bucket: "bank", amount, reason: "order_payment", subscription: subscriptionId });
  } else if (paymentMethod === "card") {
    await moveBucket({ bucket: "bank", amount, reason: "order_payment", subscription: subscriptionId });
  } else if (branchId) {
    await moveBucket({ bucket: "cash", branchId, amount, reason: "order_payment", subscription: subscriptionId });
  }
}

export async function applyExpense(expense) {
  const bucket = expense.paymentSource === "bank" ? "bank" : "cash";
  await moveBucket({ bucket, branchId: expense.branch, amount: -expense.amount, reason: "expense", expense: expense._id });
}

export async function reverseExpense(expense, note = "Расход удалён/изменён") {
  const bucket = expense.paymentSource === "bank" ? "bank" : "cash";
  await moveBucket({ bucket, branchId: expense.branch, amount: expense.amount, reason: "expense", expense: expense._id, note });
}

// "Сдать наличку в банк" — owner physically deposits till cash into the
// company account. Moves money between buckets without being revenue or
// an expense, logged as a matched pair of movements.
export async function transferCashToBank({ branchId, amount, note, adminId }) {
  if (!(amount > 0)) throw new Error("Сумма перевода должна быть больше нуля");
  const branch = await Branch.findById(branchId);
  if (!branch) throw new Error("Филиал не найден");
  if (branch.cashBalance < amount) throw new Error("В кассе недостаточно средств для перевода");
  await moveBucket({ bucket: "cash", branchId, amount: -amount, reason: "transfer_to_bank", note, createdBy: adminId });
  await moveBucket({ bucket: "bank", amount, reason: "transfer_to_bank", note, createdBy: adminId });
}

// Manual correction — admin types the real counted amount, not a delta
// (e.g. setting the opening balance, or fixing a miscount); the delta is
// computed here so the movement log still reads as a normal entry.
export async function adjustBalance({ bucket, branchId, targetAmount, note, adminId }) {
  if (!Number.isFinite(targetAmount)) throw new Error("Укажите сумму");
  let current;
  if (bucket === "cash") {
    const branch = await Branch.findById(branchId);
    if (!branch) throw new Error("Филиал не найден");
    current = branch.cashBalance;
  } else {
    const settings = await SiteSettings.findOne({ key: "homepage" });
    current = settings?.bankBalance ?? 0;
  }
  const delta = targetAmount - current;
  if (delta === 0) return current;
  return moveBucket({ bucket, branchId, amount: delta, reason: "manual_adjustment", note, createdBy: adminId });
}
