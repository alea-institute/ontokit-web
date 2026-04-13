import { describe, expect, it, beforeEach, vi } from "vitest";
import {
  mockFetch,
  mockOk,
  resetFetch,
} from "@/__tests__/helpers/mockFetch";
import { qualityApi, createQualityWebSocket } from "@/lib/api/quality";

describe("qualityApi", () => {
  beforeEach(() => {
    resetFetch();
  });

  describe("getCrossReferences", () => {
    it("fetches cross references for an entity", async () => {
      const data = { incoming: [], outgoing: [] };
      mockOk(data);

      const result = await qualityApi.getCrossReferences(
        "proj-1",
        "http://example.org/Foo"
      );
      expect(result).toEqual(data);

      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toContain(
        "/api/v1/projects/proj-1/entities/" +
          encodeURIComponent("http://example.org/Foo") +
          "/references"
      );
      expect(options.method).toBe("GET");
    });

    it("includes token and branch when provided", async () => {
      mockOk({ incoming: [], outgoing: [] });

      await qualityApi.getCrossReferences(
        "proj-1",
        "http://example.org/Foo",
        "tok",
        "dev"
      );

      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toContain("branch=dev");
      const headers = new Headers(options.headers);
      expect(headers.get("Authorization")).toBe("Bearer tok");
    });

    it("omits auth header when no token", async () => {
      mockOk({ incoming: [], outgoing: [] });

      await qualityApi.getCrossReferences("proj-1", "http://example.org/Foo");

      const [, options] = mockFetch.mock.calls[0];
      const headers = new Headers(options.headers);
      expect(headers.get("Authorization")).toBeNull();
    });
  });

  describe("triggerConsistencyCheck", () => {
    it("triggers a consistency check", async () => {
      const data = { job_id: "job-1" };
      mockOk(data);

      const result = await qualityApi.triggerConsistencyCheck("proj-1", "tok");
      expect(result).toEqual(data);

      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toContain("/api/v1/projects/proj-1/quality/check");
      expect(options.method).toBe("POST");
    });

    it("includes branch param", async () => {
      mockOk({ job_id: "job-1" });

      await qualityApi.triggerConsistencyCheck("proj-1", "tok", "dev");

      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain("branch=dev");
    });
  });

  describe("getConsistencyIssues", () => {
    it("fetches consistency issues", async () => {
      const data = { issues: [], total: 0 };
      mockOk(data);

      const result = await qualityApi.getConsistencyIssues("proj-1");
      expect(result).toEqual(data);

      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain("/api/v1/projects/proj-1/quality/issues");
    });
  });

  describe("triggerDuplicateDetection", () => {
    it("triggers duplicate detection and returns job_id", async () => {
      const data = { job_id: "dup-job-1" };
      mockOk(data);

      const result = await qualityApi.triggerDuplicateDetection("proj-1", "tok");
      expect(result).toEqual(data);

      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toContain("/api/v1/projects/proj-1/quality/duplicates");
      expect(options.method).toBe("POST");
      expect(url).toContain("threshold=0.85");
    });

    it("passes custom threshold and branch", async () => {
      mockOk({ job_id: "dup-job-2" });

      await qualityApi.triggerDuplicateDetection("proj-1", "tok", "dev", 0.9);

      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain("threshold=0.9");
      expect(url).toContain("branch=dev");
    });
  });

  describe("getDuplicateJobResult", () => {
    it("fetches duplicate detection result by job ID", async () => {
      const data = { clusters: [], threshold: 0.85, checked_at: "" };
      mockOk(data);

      const result = await qualityApi.getDuplicateJobResult("proj-1", "job-1", "tok");
      expect(result).toEqual(data);

      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toContain("/api/v1/projects/proj-1/quality/duplicates/jobs/job-1");
      expect(options.method).toBe("GET");
    });
  });

  describe("getLatestDuplicates", () => {
    it("fetches latest cached duplicate results", async () => {
      const data = { clusters: [], threshold: 0.85, checked_at: "" };
      mockOk(data);

      const result = await qualityApi.getLatestDuplicates("proj-1", "tok", "dev");
      expect(result).toEqual(data);

      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain("/api/v1/projects/proj-1/quality/duplicates/latest");
      expect(url).toContain("branch=dev");
    });

    it("omits auth header when no token", async () => {
      mockOk({ clusters: [], threshold: 0.85, checked_at: "" });

      await qualityApi.getLatestDuplicates("proj-1");

      const [, options] = mockFetch.mock.calls[0];
      const headers = new Headers(options.headers);
      expect(headers.get("Authorization")).toBeNull();
    });
  });

  describe("getDuplicateJobResult", () => {
    it("omits auth header when no token", async () => {
      mockOk({ clusters: [], threshold: 0.85, checked_at: "" });

      await qualityApi.getDuplicateJobResult("proj-1", "job-1");

      const [, options] = mockFetch.mock.calls[0];
      const headers = new Headers(options.headers);
      expect(headers.get("Authorization")).toBeNull();
    });
  });
});

describe("createQualityWebSocket", () => {
  let mockWsInstance: {
    onmessage: ((event: MessageEvent) => void) | null;
    onerror: ((event: Event) => void) | null;
    onclose: ((event: CloseEvent) => void) | null;
  };
  let WsMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockWsInstance = { onmessage: null, onerror: null, onclose: null };
    // Use a class-style mock so `new WebSocket(...)` works
    WsMock = vi.fn().mockImplementation(function () { return mockWsInstance; });
    vi.stubGlobal("WebSocket", WsMock);
  });

  it("creates WebSocket with correct URL and token", () => {
    createQualityWebSocket("proj-1", vi.fn(), undefined, undefined, "my-tok");

    expect(WsMock).toHaveBeenCalledWith(
      expect.stringContaining("/api/v1/projects/proj-1/quality/ws?token=my-tok")
    );
  });

  it("creates WebSocket without token param when none provided", () => {
    createQualityWebSocket("proj-1", vi.fn());

    const url = WsMock.mock.calls[0][0] as string;
    expect(url).toContain("/api/v1/projects/proj-1/quality/ws");
    expect(url).not.toContain("token=");
  });

  it("calls onMessage with parsed data on message event", () => {
    const onMessage = vi.fn();
    createQualityWebSocket("proj-1", onMessage);

    const payload = { type: "duplicates_complete", project_id: "proj-1", branch: "main" };
    mockWsInstance.onmessage!(new MessageEvent("message", { data: JSON.stringify(payload) }));

    expect(onMessage).toHaveBeenCalledWith(payload);
  });

  it("handles JSON parse errors in onmessage gracefully", () => {
    const onMessage = vi.fn();
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    createQualityWebSocket("proj-1", onMessage);

    mockWsInstance.onmessage!(new MessageEvent("message", { data: "not-json" }));

    expect(onMessage).not.toHaveBeenCalled();
    expect(consoleSpy).toHaveBeenCalledWith(
      "Failed to parse quality WebSocket message:",
      expect.any(SyntaxError)
    );
    consoleSpy.mockRestore();
  });

  it("calls onError callback on error event", () => {
    const onError = vi.fn();
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    createQualityWebSocket("proj-1", vi.fn(), onError);

    const errorEvent = new Event("error");
    mockWsInstance.onerror!(errorEvent);

    expect(onError).toHaveBeenCalledWith(errorEvent);
    consoleSpy.mockRestore();
  });

  it("calls onClose callback on close event", () => {
    const onClose = vi.fn();
    createQualityWebSocket("proj-1", vi.fn(), undefined, onClose);

    const closeEvent = new CloseEvent("close", { code: 1000 });
    mockWsInstance.onclose!(closeEvent);

    expect(onClose).toHaveBeenCalledWith(closeEvent);
  });
});
