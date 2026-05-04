import { vi } from "vitest";

export const mockFetch = vi.fn();
global.fetch = mockFetch;

export function mockOk(data: unknown) {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    text: () => Promise.resolve(JSON.stringify(data)),
  });
}

export function mockEmpty() {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    text: () => Promise.resolve(""),
  });
}

export function mockError(status: number, statusText: string, body: string) {
  mockFetch.mockResolvedValueOnce({
    ok: false,
    status,
    statusText,
    text: () => Promise.resolve(body),
  });
}

export function resetFetch() {
  mockFetch.mockReset();
}
