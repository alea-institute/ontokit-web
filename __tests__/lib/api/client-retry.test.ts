import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { api, ApiError } from "@/lib/api/client";

/**
 * The `retryOn5xx` opt-out (KTD16 client half).
 *
 * The shared client retries any 5xx up to three attempts. For a read that is
 * harmless; for an actuation (a verdict, a merge) it is a double-actuation
 * vector, and React Query's `retry: false` cannot reach it — the retry happens
 * *inside* one `queryFn` call. These tests pin the opt-out at the layer that
 * actually owns the loop.
 */

const mockFetch = vi.fn();
global.fetch = mockFetch;

function mock5xx() {
  return {
    ok: false,
    status: 500,
    statusText: "Internal Server Error",
    text: () => Promise.resolve("server error"),
  };
}

describe("request retryOn5xx opt-out", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it("makes exactly ONE fetch call for a 5xx when retryOn5xx is false", async () => {
    mockFetch.mockResolvedValue(mock5xx());

    await expect(
      api.post("/api/v1/pr-party/cards/c1/actions", { a: 1 }, { retryOn5xx: false })
    ).rejects.toThrow(ApiError);

    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("does not leak the retryOn5xx flag into the fetch init", async () => {
    mockFetch.mockResolvedValue({ ok: true, text: () => Promise.resolve("{}") });

    await api.get("/api/v1/anything", { retryOn5xx: false });

    const [, options] = mockFetch.mock.calls[0];
    expect(options.retryOn5xx).toBeUndefined();
  });

  it("keeps the Authorization header when retryOn5xx is passed alongside it", async () => {
    // Regression for the ported-client auth drop: adding an option must not
    // displace the headers the caller supplied in the same object.
    mockFetch.mockResolvedValue({ ok: true, text: () => Promise.resolve("{}") });

    await api.post("/api/v1/pr-party/cards/c1/actions", { a: 1 }, {
      headers: { Authorization: "Bearer tok" },
      retryOn5xx: false,
    });

    const [, options] = mockFetch.mock.calls[0];
    expect(new Headers(options.headers).get("Authorization")).toBe("Bearer tok");
  });
});

describe("request retry default (opt-out is off by default)", () => {
  beforeEach(() => {
    mockFetch.mockReset();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("still retries 5xx three times for callers that pass no flag", async () => {
    mockFetch.mockResolvedValue(mock5xx());

    let caught: unknown;
    const handled = api.get("/api/v1/plain").catch((e) => {
      caught = e;
    });
    await vi.advanceTimersByTimeAsync(1000);
    await vi.advanceTimersByTimeAsync(2000);
    await handled;

    expect(caught).toBeInstanceOf(ApiError);
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it("still retries when retryOn5xx is explicitly true", async () => {
    mockFetch
      .mockResolvedValueOnce(mock5xx())
      .mockResolvedValueOnce(mock5xx())
      .mockResolvedValueOnce({ ok: true, text: () => Promise.resolve('{"ok":true}') });

    const promise = api.get("/api/v1/flaky", { retryOn5xx: true });
    await vi.advanceTimersByTimeAsync(1000);
    await vi.advanceTimersByTimeAsync(2000);

    await expect(promise).resolves.toEqual({ ok: true });
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });
});
