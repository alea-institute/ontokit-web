import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createIndexWebSocket } from "@/lib/api/indexStatus";
import { createLintWebSocket } from "@/lib/api/lint";
import { createQualityWebSocket } from "@/lib/api/quality";
import { getWebSocketUrl } from "@/lib/api/websocketUrl";

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_WS_URL", "");
  vi.stubEnv("NEXT_PUBLIC_API_URL", "");
  vi.stubEnv("NODE_ENV", "production");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("getWebSocketUrl", () => {
  it("preserves an explicit WebSocket URL over the API URL", () => {
    vi.stubEnv("NEXT_PUBLIC_WS_URL", "wss://socket.example.com/base");
    vi.stubEnv("NEXT_PUBLIC_API_URL", "https://api.example.com");
    expect(getWebSocketUrl()).toBe("wss://socket.example.com/base");
  });

  it("allows an explicit WebSocket URL without an API URL", () => {
    vi.stubEnv("NEXT_PUBLIC_WS_URL", "wss://socket.example.com");
    expect(getWebSocketUrl()).toBe("wss://socket.example.com");
  });

  it("defaults to localhost only in development", () => {
    vi.stubEnv("NODE_ENV", "development");
    expect(getWebSocketUrl()).toBe("ws://localhost:8000");
  });

  it("requires configuration in production instead of connecting to plaintext localhost", () => {
    expect(getWebSocketUrl).toThrow("Set NEXT_PUBLIC_API_URL or NEXT_PUBLIC_WS_URL");
  });
});

describe.each([
  ["index", createIndexWebSocket, "ontology/index-ws"],
  ["lint", createLintWebSocket, "lint/ws"],
  ["quality", createQualityWebSocket, "quality/ws"],
] as const)("%s WebSocket fallback", (_name, createWebSocket, endpoint) => {
  it.each([
    ["https://api.example.com:8443/base", "wss://api.example.com:8443/base"],
    ["http://localhost:8000", "ws://localhost:8000"],
  ])("derives the scheme from %s and preserves the encoded token", (apiUrl, expectedUrl) => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", apiUrl);
    const socketConstructor = vi.fn(function () { return {}; });
    vi.stubGlobal("WebSocket", socketConstructor);

    createWebSocket("p1", vi.fn(), undefined, undefined, "test token+&");

    expect(socketConstructor).toHaveBeenCalledWith(
      `${expectedUrl}/api/v1/projects/p1/${endpoint}?token=test%20token%2B%26`
    );
  });
});
