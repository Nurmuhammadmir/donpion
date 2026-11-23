declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        openTelegramLink?: (url: string) => void;
        openLink?: (url: string, options?: { try_instant_view?: boolean }) => void;
      };
    };
  }
}

// A plain `window.location.href = externalUrl` works in a normal browser,
// but inside the Telegram Mini App's own embedded WebView it fails outright
// — Telegram intercepts top-level navigation to an external host instead of
// following it, which surfaces to the page as net::ERR_UNKNOWN_URL_SCHEME
// rather than ever reaching that host (confirmed live: this is exactly what
// broke the Click/Payme pay buttons for anyone checking out through the
// bot/Mini App). `WebApp.openLink` is Telegram's own API for this — it hands
// the URL to the system browser instead of the Mini App's WebView. Outside
// Telegram, `window.Telegram` is simply undefined and this just falls back
// to a normal navigation.
export function openExternalLink(url: string) {
  if (typeof window === "undefined") return;
  const webApp = window.Telegram?.WebApp;
  if (webApp?.openLink) {
    webApp.openLink(url);
  } else {
    window.location.href = url;
  }
}
