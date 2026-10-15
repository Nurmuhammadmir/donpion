// Tells the Next.js client "data changed, drop your ISR cache now" — see
// client/src/app/api/revalidate/route.ts. Fire-and-forget: a slow or failed
// ping must never hold up (or fail) the actual admin write, since the write
// already succeeded in MongoDB by the time this runs. Worst case without
// this, changes just take up to the page's normal `revalidate` window to
// appear — never a data-loss risk.
export function notifyRevalidate() {
  const clientUrl = process.env.CLIENT_URL;
  const secret = process.env.REVALIDATE_SECRET;

  if (!clientUrl || !secret) return;

  fetch(`${clientUrl}/api/revalidate?secret=${encodeURIComponent(secret)}`, {
    method: "POST",
  }).catch((err) => {
    console.warn("Revalidate ping failed (non-fatal):", err.message);
  });
}
