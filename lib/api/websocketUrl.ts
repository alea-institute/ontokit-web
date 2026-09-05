/** Resolve the browser-facing WebSocket base URL without a plaintext production default. */
export function getWebSocketUrl(): string {
  if (process.env.NEXT_PUBLIC_WS_URL) {
    return process.env.NEXT_PUBLIC_WS_URL;
  }

  const apiUrl = process.env.NEXT_PUBLIC_API_URL ||
    (process.env.NODE_ENV === "development" ? "http://localhost:8000" : undefined);

  if (!apiUrl) {
    throw new Error("Set NEXT_PUBLIC_API_URL or NEXT_PUBLIC_WS_URL for WebSocket connections");
  }

  return apiUrl.replace(/^http(s?):\/\//, "ws$1://");
}
