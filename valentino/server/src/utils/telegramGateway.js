// Telegram Gateway (https://core.telegram.org/gateway) — Telegram's own
// phone-verification product. Given just a phone number it delivers a code
// straight from Telegram itself, no bot interaction required; we then hand
// the code the visitor typed back to Telegram for validation, so the code
// value itself never has to be generated or stored on our side.
const token = process.env.TELEGRAM_GATEWAY_TOKEN;
const GATEWAY_BASE = "https://gatewayapi.telegram.org";

async function gatewayCall(method, params) {
  if (!token) {
    throw new Error("TELEGRAM_GATEWAY_TOKEN is not set — add it to server/.env to enable customer login.");
  }

  const res = await fetch(`${GATEWAY_BASE}/${method}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(params),
  });

  const data = await res.json();
  if (!data.ok) {
    throw new Error(data.error || `Telegram Gateway ${method} failed`);
  }
  return data.result;
}

export function isGatewayConfigured() {
  return Boolean(token);
}

export async function sendVerificationMessage(phoneNumber) {
  return gatewayCall("sendVerificationMessage", {
    phone_number: phoneNumber,
    code_length: 6,
    ttl: 300,
  });
}

export async function checkVerificationStatus(requestId, code) {
  return gatewayCall("checkVerificationStatus", { request_id: requestId, code });
}
