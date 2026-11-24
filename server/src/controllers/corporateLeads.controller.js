import asyncHandler from "express-async-handler";
import CorporateLead from "../models/CorporateLead.js";
import { sendTelegramMessage } from "../utils/telegramBot.js";

// POST /api/corporate-leads  (public, no login — see model comment)
export const createCorporateLead = asyncHandler(async (req, res) => {
  const { name, phone, companyName, comment } = req.body;
  if (!String(name || "").trim() || !String(phone || "").trim()) {
    res.status(400);
    throw new Error("Укажите имя и телефон");
  }

  const lead = await CorporateLead.create({
    name: String(name).trim(),
    phone: String(phone).trim(),
    companyName: companyName ? String(companyName).trim() : "",
    comment: comment ? String(comment).trim().slice(0, 1000) : "",
  });

  const adminChatId = process.env.ADMIN_TELEGRAM_CHAT_ID;
  if (adminChatId) {
    const lines = [
      `🏢 <b>Заявка на корпоративный заказ</b>`,
      "",
      `Имя: ${lead.name}`,
      `Телефон: ${lead.phone}`,
    ];
    if (lead.companyName) lines.push(`Компания: ${lead.companyName}`);
    if (lead.comment) lines.push("", lead.comment);
    sendTelegramMessage(adminChatId, lines.join("\n"), { parseMode: "HTML" });
  }

  res.status(201).json({ message: "Заявка отправлена" });
});

// GET /api/corporate-leads  (admin) — ?status=new
export const getCorporateLeads = asyncHandler(async (req, res) => {
  const { status } = req.query;
  const filter = {};
  if (status) filter.status = status;
  const leads = await CorporateLead.find(filter).sort({ createdAt: -1 });
  res.json(leads);
});

// PATCH /api/corporate-leads/:id  (admin) — body: { status }
export const updateCorporateLeadStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;
  if (!["new", "contacted", "closed"].includes(status)) {
    res.status(400);
    throw new Error("Некорректный статус");
  }
  const lead = await CorporateLead.findByIdAndUpdate(req.params.id, { status }, { new: true });
  if (!lead) {
    res.status(404);
    throw new Error("Заявка не найдена");
  }
  res.json(lead);
});
