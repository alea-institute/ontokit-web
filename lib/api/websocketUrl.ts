/**
 * Resolve the browser-facing WebSocket base URL.
 *
 * Precedence: NEXT_PUBLIC_WS_URL, then NEXT_PUBLIC_API_URL with its scheme
 * mapped (https -> wss, http -> ws), then the page origin when the page itself
 * is served over TLS (the API is proxied under the web hostname on DEV), and
 * finally the local-development default. This never throws: callers open
 * sockets inside timers with no handler, so a throw would be a silent outage.
 */
export function getWebSocketUrl(): string {
  if (process.env.NEXT_PUBLIC_WS_URL) {
    return process.env.NEXT_PUBLIC_WS_URL;
  }

  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL.replace(/^http(s?):\/\//, "ws$1://");
  }

  if (typeof window !== "undefined" && window.location?.protocol === "https:") {
    return `wss://${window.location.host}`;
  }

  return "ws://localhost:8000";
}
