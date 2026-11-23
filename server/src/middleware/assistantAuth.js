// Read-only access for the owner's own digital assistant (ТЗ 3.4) — a
// single long-lived shared secret, not a per-admin JWT: this is meant for
// an unattended script/bot calling in every morning, not a person logging
// in. Checked as a plain Bearer token against one env var; never logs the
// key itself anywhere.
export function protectAssistant(req, res, next) {
  const expected = process.env.ASSISTANT_API_KEY;
  if (!expected) {
    res.status(503);
    throw new Error("Доступ для ассистента не настроен (ASSISTANT_API_KEY)");
  }

  const header = req.headers.authorization;
  const key = header && header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!key || key !== expected) {
    res.status(401);
    throw new Error("Not authorized");
  }
  next();
}
