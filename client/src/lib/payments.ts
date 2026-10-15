// Shared by CheckoutForm (pay button right after placing an order) and
// CartCurrentOrder (pay button for a still-unpaid order found later, e.g.
// after the customer navigated away or refreshed) — both need the exact
// same redirect links, just from different pages.
const CLICK_SERVICE_ID = process.env.NEXT_PUBLIC_CLICK_SERVICE_ID;
const CLICK_MERCHANT_ID = process.env.NEXT_PUBLIC_CLICK_MERCHANT_ID;
const PAYME_MERCHANT_ID = process.env.NEXT_PUBLIC_PAYME_MERCHANT_ID;

export interface PayableOrder {
  orderNumber: string;
  totalAmount: number;
}

// Always the checkout page, regardless of which page the customer paid
// from — that's the one page that knows how to read ?order=... back and
// show the order's current status (see CheckoutForm's checkingReturn effect).
function checkoutReturnUrl(orderNumber: string, locale: string) {
  const url = new URL(`${window.location.origin}/${locale}/checkout`);
  url.searchParams.set("order", orderNumber);
  return url;
}

// Click's payment-redirect link (docs.click.uz/click-button) — null when the
// env vars aren't configured yet so the caller can hide the pay button
// instead of sending the customer to a broken URL.
export function buildClickPayUrl(order: PayableOrder, locale: string): string | null {
  if (!CLICK_SERVICE_ID || !CLICK_MERCHANT_ID) return null;

  const url = new URL("https://my.click.uz/services/pay");
  url.searchParams.set("service_id", CLICK_SERVICE_ID);
  url.searchParams.set("merchant_id", CLICK_MERCHANT_ID);
  url.searchParams.set("amount", order.totalAmount.toFixed(2));
  url.searchParams.set("transaction_param", order.orderNumber);
  url.searchParams.set("return_url", checkoutReturnUrl(order.orderNumber, locale).toString());
  return url.toString();
}

// Payme's checkout link (docs.help.paycom.uz/initsializatsiya-platezhey) —
// not a query string: params are joined as "key=value;key=value", then the
// whole string is base64-encoded and appended to the checkout host. Each
// value is URI-encoded first — the return URL contains "=" and ":" which
// would otherwise collide with the ";"/"=" the format itself uses.
export function buildPaymePayUrl(order: PayableOrder, locale: string): string | null {
  if (!PAYME_MERCHANT_ID) return null;

  const amountTiyin = Math.round(order.totalAmount * 100);
  const returnUrl = checkoutReturnUrl(order.orderNumber, locale);
  // "ac.order_id" must match PAYME_ACCOUNT_FIELD in server/src/utils/payme.js
  // and the Account parameter name configured in the Payme cabinet.
  const params = [
    `m=${PAYME_MERCHANT_ID}`,
    `ac.order_id=${encodeURIComponent(order.orderNumber)}`,
    `a=${amountTiyin}`,
    `c=${encodeURIComponent(returnUrl.toString())}`,
  ].join(";");

  return `https://checkout.paycom.uz/${window.btoa(params)}`;
}
