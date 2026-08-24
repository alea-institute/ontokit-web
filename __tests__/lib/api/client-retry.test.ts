import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { api, ApiError } from "@/lib/api/client";

/** Method-aware 5xx retry posture at the layer that owns the retry loop. */

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

describe("request retry defaults", () => {
  beforeEach(() => {
    mockFetch.mockReset();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("retries GET 5xx responses three times by default", async () => {
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

  const mutationRequests = {
    POST: (options?: { retryOn5xx?: boolean }) => api.post("/api/v1/flaky", { value: 1 }, options),
    PUT: (options?: { retryOn5xx?: boolean }) => api.put("/api/v1/flaky", { value: 1 }, options),
    PATCH: (options?: { retryOn5xx?: boolean }) => api.patch("/api/v1/flaky", { value: 1 }, options),
    DELETE: (options?: { retryOn5xx?: boolean }) => api.delete("/api/v1/flaky", options),
  };

  it.each(Object.entries(mutationRequests))(
    "%s does not retry a 5xx by default",
    async (_method, makeRequest) => {
      mockFetch.mockResolvedValue(mock5xx());

      let caught: unknown;
      const handled = makeRequest().catch((error) => {
        caught = error;
      });
      await vi.advanceTimersByTimeAsync(3000);
      await handled;

      expect(caught).toBeInstanceOf(ApiError);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    },
  );

  it.each(Object.entries(mutationRequests))(
    "%s retries when retryOn5xx is explicitly true",
    async (_method, makeRequest) => {
      mockFetch
        .mockResolvedValueOnce(mock5xx())
        .mockResolvedValueOnce(mock5xx())
        .mockResolvedValueOnce({ ok: true, text: () => Promise.resolve('{"ok":true}') });

      const promise = makeRequest({ retryOn5xx: true });
      await vi.advanceTimersByTimeAsync(1000);
      await vi.advanceTimersByTimeAsync(2000);

      await expect(promise).resolves.toEqual({ ok: true });
      expect(mockFetch).toHaveBeenCalledTimes(3);
    },
  );
});
