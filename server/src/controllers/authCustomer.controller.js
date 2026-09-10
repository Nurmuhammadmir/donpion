import crypto from "crypto";
import jwt from "jsonwebtoken";
import asyncHandler from "express-async-handler";
import PhoneVerification from "../models/PhoneVerification.js";
import Customer from "../models/Customer.js";
import { sendVerificationMessage, checkVerificationStatus } from "../utils/telegramGateway.js";
import { botUsername, isBotConfigured, generateCode, sendTelegramMessage } from "../utils/telegramBot.js";

const TTL_MS = 15 * 60 * 1000; // covers both channels; Gateway enforces its own shorter 5-min code expiry itself
const CUSTOMER_COOKIE = "donpion_customer";
const MAX_BOT_ATTEMPTS = 5;

function normalizePhone(raw) {
  const digits = String(raw || "").replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) return digits;
  if (digits.length === 9) return `+998${digits}`;
  return digits ? `+${digits}` : "";
}

function customerCookieOptions() {
  const isProd = process.env.NODE_ENV === "production";
  return {
    httpOnly: true,
    secure: isProd,
    // SameSite=None+Secure is what lets the cookie survive the Telegram
    // Mini App WebView in production; localhost has no HTTPS, so dev falls
    // back to Lax (still sent for same-site cross-port fetches).
    sameSite: isProd ? "none" : "lax",
    path: "/",
  };
}

// POST /api/auth/customer/register — step 1: name + phone. Both channels
// are attempted together whenever available: Telegram Gateway (instant,
// no bot interaction) and the bot. For a returning customer whose chat is
// already known (they pressed Start on some earlier order), the bot code
// is pushed straight to that chat — no need to open the bot and press
// Start again. A first-time visitor still gets the deep link. Either
// code, whichever actually arrives, works at /verify.
export const registerCustomer = asyncHandler(async (req, res) => {
  const { name, phone } = req.body;
  const cleanName = String(name || "").trim();
  const cleanPhone = normalizePhone(phone);

  if (!cleanName || !cleanPhone) {
    res.status(400);
    throw new Error("Укажите имя и номер телефона");
  }

  let gatewayRequestId = "";
  try {
    const result = await sendVerificationMessage(cleanPhone);
    gatewayRequestId = result.request_id;
  } catch (err) {
    console.warn("Telegram Gateway unavailable:", err.message);
  }

  const botAvailable = isBotConfigured();

  if (!gatewayRequestId && !botAvailable) {
    res.status(503);
    throw new Error("Подтверждение по телефону временно недоступно, попробуйте позже");
  }

  const existingCustomer = botAvailable ? await Customer.findOne({ phone: cleanPhone }) : null;

  let botCode = "";
  let botSent = false;
  if (existingCustomer?.telegramChatId) {
    botCode = generateCode();
    // <code> renders as a monospace block that Telegram clients let you
    // tap/click to copy straight to the clipboard.
    await sendTelegramMessage(
      existingCustomer.telegramChatId,
      `Код подтверждения DonPion: <code>${botCode}</code>\n\nНажмите на код, чтобы скопировать, и введите его на сайте, чтобы завершить регистрацию.`,
      { withMiniAppButton: true, parseMode: "HTML" }
    );
    botSent = true;
  }

  // Atomic upsert keyed on the unique `phone` index — replaces any older
  // still-valid record for this phone in one step (a retry, or two
  // near-simultaneous requests, can never both leave a live record behind
  // with two different codes; see the schema comment on `phone`).
  const registrationId = crypto.randomBytes(16).toString("hex");
  await PhoneVerification.findOneAndUpdate(
    { phone: cleanPhone },
    {
      registrationId,
      gatewayRequestId,
      botCode,
      botAttempts: 0,
      telegramChatId: existingCustomer?.telegramChatId || "",
      telegramUsername: existingCustomer?.telegramUsername || "",
      phone: cleanPhone,
      name: cleanName,
      expiresAt: new Date(Date.now() + TTL_MS),
    },
    { upsert: true, new: true }
  );

  res.status(201).json({
    registrationId,
    gatewaySent: Boolean(gatewayRequestId),
    botSent,
    // Still handed over even when botSent — a working fallback the visitor
    // can open by hand if the direct message doesn't arrive for some reason.
    botLink: botAvailable ? `https://t.me/${botUsername()}?start=${registrationId}` : null,
  });
});

// GET /api/auth/customer/status/:registrationId — the client polls this
// while waiting for the visitor to press Start in the bot, so it can show
// "code sent" the moment the bot channel actually delivers one.
export const getVerificationStatus = asyncHandler(async (req, res) => {
  const verification = await PhoneVerification.findOne({ registrationId: req.params.registrationId });
  if (!verification) {
    res.status(404);
    throw new Error("Сессия не найдена или истекла");
  }
  res.json({ codeSent: Boolean(verification.botCode) });
});

// POST /api/auth/customer/verify — step 2: one code field, checked against
// whichever channel actually delivered it.
export const verifyCustomer = asyncHandler(async (req, res) => {
  const { registrationId, code } = req.body;
  const cleanCode = String(code || "").trim();

  const verification = await PhoneVerification.findOne({ registrationId });
  if (!verification || verification.expiresAt < new Date()) {
    res.status(400);
    throw new Error("Сессия истекла, начните заново");
  }

  // Check the bot code first — a free local comparison, so a valid bot
  // code never gets burned as a wasted (and separately rate-limited)
  // attempt against Gateway's own check below.
  let verified = Boolean(verification.botCode) && cleanCode === verification.botCode;

  if (!verified && verification.gatewayRequestId) {
    try {
      const result = await checkVerificationStatus(verification.gatewayRequestId, cleanCode);
      const status = result.verification_status?.status;
      if (status === "code_valid") {
        verified = true;
      } else if (status === "code_max_attempts_exceeded") {
        res.status(429);
        throw new Error("Слишком много попыток, начните заново");
      }
    } catch (err) {
      console.warn("Gateway verification check failed:", err.message);
    }
  }

  if (!verified && verification.botCode) {
    verification.botAttempts += 1;
    if (verification.botAttempts >= MAX_BOT_ATTEMPTS) {
      await verification.save();
      res.status(429);
      throw new Error("Слишком много попыток, начните заново");
    }
    await verification.save();
  }

  if (!verified) {
    res.status(400);
    throw new Error("Неверный код");
  }

  let customer = await Customer.findOne({ phone: verification.phone });
  if (customer) {
    customer.name = verification.name;
    if (verification.telegramChatId) customer.telegramChatId = verification.telegramChatId;
    if (verification.telegramUsername) customer.telegramUsername = verification.telegramUsername;
    await customer.save();
  } else {
    customer = await Customer.create({
      name: verification.name,
      phone: verification.phone,
      telegramChatId: verification.telegramChatId,
      telegramUsername: verification.telegramUsername,
    });
  }

  await PhoneVerification.deleteOne({ _id: verification._id });

  const jwtToken = jwt.sign({ id: customer._id, phone: customer.phone }, process.env.JWT_SECRET, {
    expiresIn: "180d",
  });

  // 180 days — the browser (including inside the Telegram Mini App WebView)
  // should keep remembering this visitor well beyond a single session.
  res.cookie(CUSTOMER_COOKIE, jwtToken, { ...customerCookieOptions(), maxAge: 180 * 24 * 60 * 60 * 1000 });
  res.json({ customer: { id: customer._id, name: customer.name, phone: customer.phone } });
});

// GET /api/auth/customer/me
export const getCurrentCustomer = asyncHandler(async (req, res) => {
  res.json({ customer: req.customer });
});

// POST /api/auth/customer/logout
export const logoutCustomer = asyncHandler(async (req, res) => {
  res.clearCookie(CUSTOMER_COOKIE, customerCookieOptions());
  res.json({ ok: true });
});

export { CUSTOMER_COOKIE };
