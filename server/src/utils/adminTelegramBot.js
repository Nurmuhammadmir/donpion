// @donpionadminbot — a separate bot/token from utils/telegramBot.js (the
// customer-facing phone-verification one). Replies to /start with a
// greeting and a Mini App button into the admin panel, and — when the
// owner's own @Orbitagroupuz account does so — remembers their chat id so
// login-alert notifications (see loginAlert.js) have somewhere to go. A
// bot can't message someone who hasn't messaged it first, so this capture
// has to happen live; it can't be set up from a username alone.
import SiteSettings from "../models/SiteSettings.js";

const OWNER_USERNAME = "orbitagroupuz";

const token = process.env.ADMIN_BOT_TOKEN;
const API_BASE = token ? `https://api.telegram.org/bot${token}` : null;

// Same CORS-whitelisted admin URL the rest of the server already trusts
// (see server.js) — Telegram only accepts https:// for web_app buttons, so
// this is skipped in local dev where ADMIN_URL is still localhost.
const ADMIN_URL = process.env.ADMIN_URL || "";
const MINI_APP_ENABLED = ADMIN_URL.startsWith("https://");

let offset = 0;
let polling = false;

function miniAppButtonMarkup() {
  if (!MINI_APP_ENABLED) return undefined;
  return { inline_keyboard: [[{ text: "Открыть панель", web_app: { url: ADMIN_URL } }]] };
}

async function sendMessage(chatId, text) {
  if (!API_BASE) return;
  try {
    const res = await fetch(`${API_BASE}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, reply_markup: miniAppButtonMarkup() }),
    });
    if (!res.ok) console.error("Admin bot sendMessage failed:", await res.text());
  } catch (err) {
    console.error("Admin bot sendMessage error:", err.message);
  }
}

// The persistent button next to the message input — set once at startup,
// Telegram remembers it from then on (same approach as the customer bot).
async function setMiniAppMenuButton() {
  if (!MINI_APP_ENABLED) {
    console.warn(`Admin bot Mini App menu button not set — ADMIN_URL (${ADMIN_URL || "unset"}) must be https://.`);
    return;
  }
  try {
    const res = await fetch(`${API_BASE}/setChatMenuButton`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ menu_button: { type: "web_app", text: "Панель", web_app: { url: ADMIN_URL } } }),
    });
    if (!res.ok) console.error("Admin bot setChatMenuButton failed:", await res.text());
  } catch (err) {
    console.error("Admin bot setChatMenuButton error:", err.message);
  }
}

async function pollOnce() {
  const res = await fetch(`${API_BASE}/getUpdates?timeout=30&offset=${offset}`);
  const data = await res.json();
  if (!data.ok) return;

  for (const update of data.result) {
    offset = update.update_id + 1;
    const msg = update.message;
    if (!msg || !msg.text || !/^\/start/.test(msg.text)) continue;

    if ((msg.chat.username || "").toLowerCase() === OWNER_USERNAME) {
      await SiteSettings.findOneAndUpdate(
        { key: "homepage" },
        { telegramOwnerChatId: String(msg.chat.id) },
        { upsert: false }
      );
    }

    await sendMessage(
      msg.chat.id,
      "Добро пожаловать в панель DonPion 🌸\n\nЭто бот-доступ к CRM — нажмите кнопку ниже, чтобы открыть панель."
    );
  }
}

// Called after a successful admin login (see auth.controller.js) — never
// awaited there, since a slow or failed Telegram ping must never hold up
// or fail the login response itself.
export async function notifyOwner(text) {
  if (!API_BASE) return;
  try {
    const settings = await SiteSettings.findOne({ key: "homepage" }).select("telegramOwnerChatId");
    if (!settings?.telegramOwnerChatId) return;
    await sendMessage(settings.telegramOwnerChatId, text);
  } catch (err) {
    console.error("Admin bot notifyOwner error:", err.message);
  }
}

async function pollLoop() {
  while (polling) {
    try {
      await pollOnce();
    } catch (err) {
      console.error("Admin bot polling error:", err.message);
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }
  }
}

if (API_BASE) {
  polling = true;
  pollLoop();
  setMiniAppMenuButton();
  console.log("Admin Telegram bot connected (polling)");
} else {
  console.warn("ADMIN_BOT_TOKEN is not set — @donpionadminbot has no active handler.");
}
