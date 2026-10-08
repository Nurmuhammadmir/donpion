import dotenv from "dotenv";

dotenv.config();

// One-off operational script — channels have no equivalent of the private-chat
// "menu button" (setChatMenuButton only applies to private chats with the bot,
// see telegramBot.js). The closest thing a channel can show is a pinned post
// with an inline button. Inline `web_app` buttons are rejected on channel
// posts (Telegram restricts those to private bot chats), so this uses a plain
// `url` button instead — but pointed at the bot's Mini App Direct Link
// (registered once via @BotFather /newapp, short name "hi7h") rather than the
// bare site URL, so Telegram still opens it as the native Mini App instead of
// a browser tab.
const token = process.env.TELEGRAM_BOT_TOKEN;
const SITE_URL = "https://t.me/DONPIONUZ_BOT/hi7h";

const chatId = process.argv[2];
if (!token) {
  console.error("TELEGRAM_BOT_TOKEN is not set in server/.env");
  process.exit(1);
}
if (!chatId) {
  console.error("Usage: node src/scripts/postChannelButton.js <channel_chat_id>");
  process.exit(1);
}

const API_BASE = `https://api.telegram.org/bot${token}`;

async function main() {
  const sendRes = await fetch(`${API_BASE}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: "🌸 DonPion — живые цветы с доставкой по Ташкенту 24/7",
      reply_markup: {
        inline_keyboard: [[{ text: "Открыть DonPion 🌸", url: SITE_URL }]],
      },
    }),
  });
  const sendData = await sendRes.json();
  if (!sendData.ok) {
    console.error("sendMessage failed:", sendData);
    process.exit(1);
  }
  console.log("Posted message_id:", sendData.result.message_id);

  const pinRes = await fetch(`${API_BASE}/pinChatMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      message_id: sendData.result.message_id,
      disable_notification: true,
    }),
  });
  const pinData = await pinRes.json();
  if (!pinData.ok) {
    console.error("pinChatMessage failed:", pinData);
    process.exit(1);
  }
  console.log("Pinned successfully.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
