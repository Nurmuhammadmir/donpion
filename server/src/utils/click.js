import crypto from "crypto";

// Shop API error codes — fixed set defined by Click (docs.click.uz/shop-api/errors).
export const CLICK_ERROR = {
  SUCCESS: 0,
  SIGN_FAILED: -1,
  AMOUNT_MISMATCH: -2,
  ACTION_NOT_FOUND: -3,
  ALREADY_PAID: -4,
  ORDER_NOT_FOUND: -5,
  TRANSACTION_NOT_FOUND: -6,
  FAILED_TO_UPDATE: -7,
  BAD_REQUEST: -8,
  TRANSACTION_CANCELLED: -9,
};

export const CLICK_ERROR_NOTE = {
  [CLICK_ERROR.SUCCESS]: "Success",
  [CLICK_ERROR.SIGN_FAILED]: "SIGN CHECK FAILED!",
  [CLICK_ERROR.AMOUNT_MISMATCH]: "Incorrect parameter amount",
  [CLICK_ERROR.ACTION_NOT_FOUND]: "Action not found",
  [CLICK_ERROR.ALREADY_PAID]: "Already paid",
  [CLICK_ERROR.ORDER_NOT_FOUND]: "Order does not exist",
  [CLICK_ERROR.TRANSACTION_NOT_FOUND]: "Transaction does not exist",
  [CLICK_ERROR.FAILED_TO_UPDATE]: "Failed to update order",
  [CLICK_ERROR.BAD_REQUEST]: "Error in request from Click",
  [CLICK_ERROR.TRANSACTION_CANCELLED]: "Transaction cancelled",
};

// md5(click_trans_id + service_id + SECRET_KEY + merchant_trans_id +
// [merchant_prepare_id, Complete only] + amount + action + sign_time) —
// the exact formula Click's own SDKs implement (see click-llc/click-integration-php,
// click/models/BasicPaymentsErrors.php). Values are concatenated as strings,
// so this must receive the same raw field values Click sent, not re-serialized numbers.
export function buildClickSignString({ clickTransId, serviceId, secretKey, merchantTransId, merchantPrepareId, amount, action, signTime }) {
  const parts = [clickTransId, serviceId, secretKey, merchantTransId];
  if (String(action) === "1") parts.push(merchantPrepareId);
  parts.push(amount, action, signTime);
  return crypto.createHash("md5").update(parts.join("")).digest("hex");
}
