import asyncHandler from "express-async-handler";
import Lead from "../models/Lead.js";
import { sendTelegramMessage } from "../utils/telegramBot.js";

// POST /api/leads  (public, no login — site's general "Задать вопрос" form)
export const createSiteLead = asyncHandler(async (req, res) => {
  const { name, phone, message } = req.body;
  if (!String(name || "").trim() || !String(phone || "").trim()) {
    res.status(400);
    throw new Error("Укажите имя и телефон");
  }

  const trimmedMessage = message ? String(message).trim().slice(0, 2000) : "";

  const lead = await Lead.create({
    channel: "site_form", // never trust a client-supplied channel
    name: String(name).trim(),
    phone: String(phone).trim(),
    message: trimmedMessage,
    messages: trimmedMessage ? [{ text: trimmedMessage }] : [],
  });

  const adminChatId = process.env.ADMIN_TELEGRAM_CHAT_ID;
  if (adminChatId) {
    const lines = [`💬 <b>Заявка с сайта</b>`, "", `Имя: ${lead.name}`, `Телефон: ${lead.phone}`];
    if (lead.message) lines.push("", lead.message);
    sendTelegramMessage(adminChatId, lines.join("\n"), { parseMode: "HTML" });
  }

  res.status(201).json({ message: "Заявка отправлена" });
});

// GET /api/manager/leads  (manager) — ?status=&channel=
export const getLeads = asyncHandler(async (req, res) => {
  const { status, channel } = req.query;
  const filter = {};
  if (status) filter.status = status;
  if (channel) filter.channel = channel;
  const leads = await Lead.find(filter).sort({ createdAt: -1 });
  res.json(leads);
});

// PATCH /api/manager/leads/:id  (manager) — body: { status }
export const updateLeadStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;
  if (!["new", "contacted", "closed"].includes(status)) {
    res.status(400);
    throw new Error("Некорректный статус");
  }
  const lead = await Lead.findByIdAndUpdate(req.params.id, { status }, { new: true });
  if (!lead) {
    res.status(404);
    throw new Error("Лид не найден");
  }
  res.json(lead);
});
