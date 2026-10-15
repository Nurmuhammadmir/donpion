// Payme Merchant API error codes (docs.help.paycom.uz/protokol-merchant-api/obschie-oshibki
// for the general ones, each method's own doc page for the rest) — a fixed
// set defined by Payme, same role as click.js's CLICK_ERROR.
export const PAYME_ERROR = {
  INVALID_AMOUNT: -31001,
  TRANSACTION_NOT_FOUND: -31003,
  CANNOT_CANCEL_FULFILLED: -31007,
  CANNOT_PERFORM: -31008,
  ACCOUNT_NOT_FOUND: -31050,
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INSUFFICIENT_PRIVILEGE: -32504,
  SYSTEM_ERROR: -32400,
};

// Payme's `account` object echoes back whichever field name is configured
// as this cashbox's "Account parameters" in the Payme cabinet — must match
// exactly, on both sides, or every call 404s on "account not found".
export const PAYME_ACCOUNT_FIELD = "order_id";

// error.message must be an object with these three keys (docs show ru/uz/en)
// — Payme displays whichever matches the buyer's app language.
export function paymeMessage(text) {
  if (typeof text === "object" && text !== null) return text;
  return { ru: text, uz: text, en: text };
}

// HTTP Basic Auth: Payme's documented example only shows the *shape*
// ("Authorization: Basic base64(Login:Pass)"), not literal credentials.
// Every known Payme Merchant API implementation (their own official SDKs
// included) uses the fixed username "Paycom" with the cashbox's secret key
// as the password — verify this holds in the sandbox before relying on it
// for a live cashbox.
export function checkPaymeAuth(req) {
  const header = req.headers.authorization || "";
  const [scheme, encoded] = header.split(" ");
  if (scheme !== "Basic" || !encoded) return false;
  let decoded;
  try {
    decoded = Buffer.from(encoded, "base64").toString("utf8");
  } catch {
    return false;
  }
  const separatorIndex = decoded.indexOf(":");
  if (separatorIndex === -1) return false;
  const login = decoded.slice(0, separatorIndex);
  const password = decoded.slice(separatorIndex + 1);
  return login === "Paycom" && password === process.env.PAYME_KEY;
}

// Payme amounts are in tiyin (1/100 som); this project prices everything in
// whole som (see formatUZS) — same money, different unit, convert at the
// boundary rather than storing tiyin anywhere in Order.
export function somToTiyin(som) {
  return Math.round(som * 100);
}
