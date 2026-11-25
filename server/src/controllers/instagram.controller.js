import crypto from "crypto";
import asyncHandler from "express-async-handler";
import Lead from "../models/Lead.js";
import { sendTelegramMessage } from "../utils/telegramBot.js";

// GET /api/instagram/webhook — Meta's one-time handshake when the webhook
// URL is registered in the Meta app dashboard. Stable Messenger-platform
// contract: hub.mode/hub.verify_token/hub.challenge as query params.
export const verifyInstagramWebhook = asyncHandler(async (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  const expected = process.env.INSTAGRAM_VERIFY_TOKEN;
  if (mode === "subscribe" && expected && token === expected) {
    res.status(200).send(challenge);
    return;
  }
  res.sendStatus(403);
});

function isValidSignature(rawBody, signatureHeader) {
  const secret = process.env.INSTAGRAM_APP_SECRET;
  if (!secret || !rawBody || !signatureHeader || !signatureHeader.startsWith("sha256=")) return false;

  const expectedHex = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  const expected = Buffer.from(expectedHex, "utf8");
  const given = Buffer.from(signatureHeader.slice("sha256=".length), "utf8");
  if (expected.length !== given.length) return false;
  return crypto.timingSafeEqual(expected, given);
}

// Best-effort — a lead with just an IGSID is barely actionable, a name
// makes it so. Never allowed to throw into the caller; failures are logged
// and the lead just keeps its blank instagramUsername.
async function enrichInstagramUsername(lead) {
  const pageToken = process.env.INSTAGRAM_PAGE_ACCESS_TOKEN;
  if (!pageToken || !lead.instagramUserId) return;
  try {
    const res = await fetch(
      `https://graph.facebook.com/v21.0/${lead.instagramUserId}?fields=name,username&access_token=${pageToken}`
    );
    const data = await res.json();
    const resolved = data.username || data.name;
    if (resolved) {
      lead.instagramUsername = resolved;
      await lead.save();
    }
  } catch (err) {
    console.error("Instagram username enrichment failed:", err.message);
  }
}

async function handleMessagingEvent(event) {
  // Meta also delivers the business's own outgoing replies through this
  // same webhook field — without this, every reply a manager sends would
  // create a brand-new lead from itself.
  if (event.message?.is_echo) return;

  const senderId = event.sender?.id;
  if (!senderId) return;

  const text = event.message?.text || "[вложение]";

  const existing = await Lead.findOne({ channel: "instagram", instagramUserId: senderId });
  if (existing) {
    existing.message = text;
    existing.messages.push({ text });
    await existing.save();
    return;
  }

  const lead = await Lead.create({
    channel: "instagram",
    instagramUserId: senderId,
    message: text,
    messages: [{ text }],
    status: "new",
  });

  const adminChatId = process.env.ADMIN_TELEGRAM_CHAT_ID;
  if (adminChatId) {
    sendTelegramMessage(adminChatId, `📩 <b>Новое сообщение в Instagram</b>\n\n${text}`, { parseMode: "HTML" });
  }

  await enrichInstagramUsername(lead);
}

async function processEntries(body) {
  for (const entry of body.entry || []) {
    for (const event of entry.messaging || []) {
      try {
        await handleMessagingEvent(event);
      } catch (err) {
        console.error("Instagram webhook event processing error:", err.message);
      }
    }
  }
}

// POST /api/instagram/webhook — real DM delivery. Verified by signature,
// not by protectAdmin/protectManager (public, self-verifying — same
// discipline as routes/click.routes.js and routes/payme.routes.js).
export const receiveInstagramWebhook = asyncHandler(async (req, res) => {
  const signature = req.headers["x-hub-signature-256"];
  if (!isValidSignature(req.rawBody, signature)) {
    res.sendStatus(403);
    return;
  }

  // Ack immediately — Meta retries aggressively and can disable the
  // webhook subscription after repeated slow/non-200 responses. Actual
  // processing happens after the response is already sent.
  res.sendStatus(200);

  processEntries(req.body).catch((err) => console.error("Instagram webhook processing error:", err.message));
});
