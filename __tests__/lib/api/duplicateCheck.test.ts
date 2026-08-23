import { beforeEach, describe, expect, it, vi } from "vitest";
import { distinctDecisionsApi } from "@/lib/api/duplicateCheck";

const mockFetch = vi.fn();
global.fetch = mockFetch;

function mockOk(data: unknown) {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    text: () => Promise.resolve(JSON.stringify(data)),
  });
}

describe("distinctDecisionsApi", () => {
  beforeEach(() => mockFetch.mockReset());

  it("marks a pair with an explicit reason and no automatic 5xx retry", async () => {
    mockOk({ id: "decision-1" });

    await distinctDecisionsApi.mark("project-1", {
      proposed_iri: "http://example.org/Proposed",
      label: "Proposed",
      candidate_iri: "http://example.org/Existing",
      reason: "Different scope",
    }, "token-1");

    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toContain("/projects/project-1/duplicate-check/distinct-decisions");
    expect(options.method).toBe("POST");
    expect(options.headers.get("Authorization")).toBe("Bearer token-1");
    expect(JSON.parse(options.body)).toMatchObject({ reason: "Different scope" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("lists bounded history and revokes by decision id", async () => {
    mockOk([]);
    await distinctDecisionsApi.list("project-1", "token-1", true, 10, 25);

    let [url, options] = mockFetch.mock.calls[0];
    expect(url).toContain("include_inactive=true");
    expect(url).toContain("skip=10");
    expect(url).toContain("limit=25");
    expect(options.method).toBe("GET");

    mockOk({ id: "decision-1", revoked_at: "2026-08-23T12:00:00Z" });
    await distinctDecisionsApi.revoke("project-1", "decision-1", "token-1");

    [url, options] = mockFetch.mock.calls[1];
    expect(url).toContain("/distinct-decisions/decision-1");
    expect(options.method).toBe("DELETE");
    expect(options.headers.get("Authorization")).toBe("Bearer token-1");
  });
});
