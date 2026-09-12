"use client";

import { useEffect } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4100/api";
const STORAGE_KEY = "donpion_visit_notified_at";
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

// Pings the server once per browser per day so the owner's Telegram gets a
// heads-up that someone's actively on the site — deliberately not on every
// single page navigated within one visit, just the first one of the day,
// so it stays a useful signal instead of a flood.
export default function VisitNotifier() {
  useEffect(() => {
    try {
      const last = Number(localStorage.getItem(STORAGE_KEY) || 0);
      if (Date.now() - last < ONE_DAY_MS) return;
      localStorage.setItem(STORAGE_KEY, String(Date.now()));
    } catch {
      // localStorage unavailable (private mode, blocked) — fall through and
      // notify anyway rather than silently never notifying for this visitor.
    }
    fetch(`${API_URL}/notify/visit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: window.location.pathname }),
    }).catch(() => {});
  }, []);

  return null;
}
