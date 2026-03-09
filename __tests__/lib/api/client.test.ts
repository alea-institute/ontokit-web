import { describe, expect, it, vi, beforeEach } from "vitest";
import { api, ApiError } from "@/lib/api/client";

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("ApiError", () => {
  it("creates error with status and statusText", () => {
    const error = new ApiError(404, "Not Found", "Resource not found");
    expect(error.status).toBe(404);
    expect(error.statusText).toBe("Not Found");
    expect(error.message).toBe("Resource not found");
    expect(error.name).toBe("ApiError");
    expect(error).toBeInstanceOf(Error);
  });
});

describe("api.get", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it("makes GET request and returns data", async () => {
    const data = { id: "1", name: "Test" };
    mockFetch.mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(JSON.stringify(data)),
    });

    const result = await api.get("/api/v1/test");
    expect(result).toEqual(data);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/v1/test");
    expect(options.method).toBe("GET");
  });

  it("throws ApiError on non-OK response", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 404,
      statusText: "Not Found",
      text: () => Promise.resolve("Not found"),
    });

    await expect(api.get("/api/v1/missing")).rejects.toThrow(ApiError);
  });

  it("handles empty response", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(""),
    });

    const result = await api.get("/api/v1/empty");
    expect(result).toBeUndefined();
  });

  it("appends query parameters", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      text: () => Promise.resolve("{}"),
    });

    await api.get("/api/v1/test", {
      params: { page: 1, q: "search", empty: undefined },
    });

    const [url] = mockFetch.mock.calls[0];
    expect(url).toContain("page=1");
    expect(url).toContain("q=search");
    expect(url).not.toContain("empty");
  });
});

describe("api.post", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it("makes POST request with JSON body", async () => {
    const responseData = { id: "1" };
    mockFetch.mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(JSON.stringify(responseData)),
    });

    const result = await api.post("/api/v1/items", { name: "New Item" });
    expect(result).toEqual(responseData);

    const [, options] = mockFetch.mock.calls[0];
    expect(options.method).toBe("POST");
    expect(options.body).toBe(JSON.stringify({ name: "New Item" }));
  });

  it("sends POST without body", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      text: () => Promise.resolve("{}"),
    });

    await api.post("/api/v1/action");
    const [, options] = mockFetch.mock.calls[0];
    expect(options.body).toBeUndefined();
  });
});

describe("api.put", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it("makes PUT request", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      text: () => Promise.resolve("{}"),
    });

    await api.put("/api/v1/items/1", { name: "Updated" });
    const [, options] = mockFetch.mock.calls[0];
    expect(options.method).toBe("PUT");
  });
});

describe("api.delete", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it("makes DELETE request", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(""),
    });

    await api.delete("/api/v1/items/1");
    const [, options] = mockFetch.mock.calls[0];
    expect(options.method).toBe("DELETE");
  });
});
