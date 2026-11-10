import { notifyOwner } from "./adminTelegramBot.js";

// Order matters: Edge's own UA string also contains "Chrome", and
// Chrome's also contains "Safari" — most-specific match has to win first.
function parseDevice(userAgent) {
  const ua = userAgent || "";
  let os = "Неизвестное устройство";
  if (/windows/i.test(ua)) os = "Windows";
  else if (/iphone/i.test(ua)) os = "iPhone";
  else if (/ipad/i.test(ua)) os = "iPad";
  else if (/mac os/i.test(ua)) os = "Mac";
  else if (/android/i.test(ua)) os = "Android";
  else if (/linux/i.test(ua)) os = "Linux";

  let browser = "неизвестный браузер";
  if (/edg\//i.test(ua)) browser = "Edge";
  else if (/opr\/|opera/i.test(ua)) browser = "Opera";
  else if (/chrome\//i.test(ua)) browser = "Chrome";
  else if (/firefox\//i.test(ua)) browser = "Firefox";
  else if (/safari\//i.test(ua)) browser = "Safari";

  return `${os} · ${browser}`;
}

function isPrivateIp(ip) {
  return !ip || ip === "::1" || /^127\.|^10\.|^192\.168\.|^::ffff:127\.|^::ffff:10\.|^::ffff:192\.168\./.test(ip);
}

// Best-effort only — a slow/blocked/rate-limited lookup must never delay
// or break the login response, so this always resolves, never rejects.
async function lookupLocation(ip) {
  if (isPrivateIp(ip)) return "локально";
  try {
    const res = await fetch(`https://ipapi.co/${ip}/json/`, { signal: AbortSignal.timeout(3000) });
    const data = await res.json();
    if (data.error) return ip;
    return [data.city, data.country_name].filter(Boolean).join(", ") || ip;
  } catch {
    return ip;
  }
}

// Fire-and-forget, called right after a successful admin login — never
// awaited by the caller (see auth.controller.js), same reasoning as
// notifyRevalidate: the login already succeeded, nothing here should be
// able to affect that.
export function notifyAdminLogin(admin, req) {
  const ip = (req.headers["x-forwarded-for"] || "").split(",")[0].trim() || req.ip;
  const device = parseDevice(req.headers["user-agent"]);
  const when = new Date().toLocaleString("ru-RU", { timeZone: "Asia/Tashkent" });

  lookupLocation(ip)
    .then((location) => {
      return notifyOwner(
        `🔐 Вход в панель DonPion\n\n` +
          `Кто: ${admin.name || admin.email}\n` +
          `Устройство: ${device}\n` +
          `Где: ${location}\n` +
          `IP: ${ip}\n` +
          `Когда: ${when}`
      );
    })
    .catch((err) => console.error("Login alert failed:", err.message));
}
