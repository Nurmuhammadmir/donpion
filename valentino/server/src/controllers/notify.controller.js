import asyncHandler from "express-async-handler";
import { sendTelegramMessage } from "../utils/telegramBot.js";

// POST /api/notify/visit  (public — fired by the client's VisitNotifier,
// at most once per browser per day, so this is a "someone's on the site
// today" heads-up, not a message per page navigated within that visit).
export const notifyVisit = asyncHandler(async (req, res) => {
  const adminChatId = process.env.ADMIN_TELEGRAM_CHAT_ID;
  if (adminChatId) {
    const path = typeof req.body?.path === "string" ? req.body.path.slice(0, 200) : "";
    sendTelegramMessage(adminChatId, `🌐 Новый посетитель на сайте${path ? `: ${path}` : ""}`);
  }
  res.status(204).end();
});
