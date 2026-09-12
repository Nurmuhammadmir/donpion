import PhoneVerification from "../models/PhoneVerification.js";

// Second delivery channel, always active alongside Telegram Gateway (see
// telegramGateway.js and registerCustomer in authCustomer.controller.js) —
// talks to the Telegram Bot HTTP API directly (native fetch, Node 18+), no
// third-party bot library. The only maintained npm package under this name
// ships a critical-CVE dependency chain (old `request`), and all we
// actually need is two calls: long-poll for /start and sendMessage.
const token = process.env.TELEGRAM_BOT_TOKEN;
const API_BASE = token ? `https://api.telegram.org/bot${token}` : null;

// Telegram only accepts HTTPS for web_app buttons/menu buttons — this is
// http://localhost in dev, so the Mini App button is silently skipped
// locally and only actually appears once CLIENT_URL is a real https domain.
const SITE_URL = process.env.CLIENT_URL || "";
const MINI_APP_ENABLED = SITE_URL.startsWith("https://");

let offset = 0;
let polling = false;

export function generateCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

// Attach to a sendMessage call to add an inline "Open Mini App" button
// under that specific message, in addition to the persistent menu button
// set once below (setChatMenuButton) — Telegram supports both at once.
function miniAppButtonMarkup() {
  if (!MINI_APP_ENABLED) return undefined;
  return {
    inline_keyboard: [[{ text: "Открыть DonPion", web_app: { url: SITE_URL } }]],
  };
}

export async function sendTelegramMessage(chatId, text, { withMiniAppButton = false, parseMode = undefined } = {}) {
  if (!API_BASE) return;
  try {
    const replyMarkup = withMiniAppButton ? miniAppButtonMarkup() : undefined;
    const res = await fetch(`${API_BASE}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        ...(parseMode ? { parse_mode: parseMode } : {}),
        ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
      }),
    });
    if (!res.ok) {
      console.error("Telegram sendMessage failed:", await res.text());
    }
  } catch (err) {
    console.error("Telegram sendMessage error:", err.message);
  }
}

export function isBotConfigured() {
  return Boolean(API_BASE);
}

export function botUsername() {
  return process.env.TELEGRAM_BOT_USERNAME || null;
}

// The persistent button next to the message input, shown in every chat
// with the bot (not just a single message) — the "profile"-level Mini App
// entry point. Set once at startup; Telegram remembers it from then on.
async function setMiniAppMenuButton() {
  if (!MINI_APP_ENABLED) {
    console.warn(`Mini App menu button not set — CLIENT_URL (${SITE_URL || "unset"}) must be https:// for Telegram to accept it.`);
    return;
  }
  try {
    const res = await fetch(`${API_BASE}/setChatMenuButton`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        menu_button: { type: "web_app", text: "DonPion", web_app: { url: SITE_URL } },
      }),
    });
    if (!res.ok) {
      console.error("Telegram setChatMenuButton failed:", await res.text());
    }
  } catch (err) {
    console.error("Telegram setChatMenuButton error:", err.message);
  }
}

// The storefront sends the visitor here as t.me/<bot>?start=<registrationId>
// right alongside its Gateway attempt. Telegram bots can't message someone
// first, so this /start is what actually links the chat to that
// registration — the bot's own code is generated and sent only once this
// fires, independent of whether Gateway already delivered its own.
async function handleStart(msg, registrationId) {
  const chatId = msg.chat.id;

  if (!registrationId) {
    // A "cold" /start — someone found the bot on their own, not via the
    // site's registration deep link. No code to send here, so this is the
    // bot's actual first impression: a warm brand greeting plus the
    // practical basics, ending with the same Mini App button used
    // everywhere else in the bot.
    await sendTelegramMessage(
      chatId,
      "Здравствуйте! 🌸 Вас приветствует команда DonPion.\n\n" +
        "Мы создаём букеты, которые говорят о чувствах лучше слов.\n\n" +
        "💐 Собираем каждый букет в день заказа\n" +
        "⚡️ Экспресс-доставка по Ташкенту — от 1 часа\n" +
        "📸 Перед отправкой пришлём фото готового букета\n" +
        "🕐 Принимаем заказы и доставляем 24/7\n\n" +
        "Выберите букет — обо всём остальном позаботится команда DonPion. 🌷\n\n" +
        "Открыть DonPion ↓",
      { withMiniAppButton: true }
    );
    return;
  }

  try {
    const verification = await PhoneVerification.findOne({ registrationId });
    if (!verification || verification.expiresAt < new Date()) {
      await sendTelegramMessage(chatId, "Ссылка устарела. Вернитесь на сайт и попробуйте снова.");
      return;
    }

    const code = generateCode();
    verification.botCode = code;
    verification.telegramChatId = String(chatId);
    verification.telegramUsername = msg.chat.username || "";
    verification.botAttempts = 0;
    await verification.save();

    // <code> renders as a monospace block that Telegram clients let you
    // tap/click to copy straight to the clipboard — no custom button
    // needed, and it works the same on mobile and desktop.
    await sendTelegramMessage(
      chatId,
      `Код подтверждения DonPion: <code>${code}</code>\n\nНажмите на код, чтобы скопировать, и введите его на сайте, чтобы завершить регистрацию.`,
      { parseMode: "HTML" }
    );
  } catch (err) {
    console.error("Telegram /start handling failed:", err.message);
  }
}

async function pollOnce() {
  const res = await fetch(`${API_BASE}/getUpdates?timeout=30&offset=${offset}`);
  const data = await res.json();
  if (!data.ok) return;

  for (const update of data.result) {
    offset = update.update_id + 1;
    const msg = update.message;
    if (!msg || !msg.text) continue;

    const match = msg.text.match(/^\/start(?:\s+(\S+))?/);
    if (match) {
      await handleStart(msg, match[1]);
    }
  }
}

async function pollLoop() {
  while (polling) {
    try {
      await pollOnce();
    } catch (err) {
      console.error("Telegram polling error:", err.message);
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }
  }
}

if (API_BASE) {
  polling = true;
  pollLoop();
  setMiniAppMenuButton();
  console.log("Telegram bot connected (polling) — fallback path for phone verification");
} else {
  console.warn(
    "TELEGRAM_BOT_TOKEN is not set — the bot fallback for phone verification is disabled (Telegram Gateway is still tried first)."
  );
}
