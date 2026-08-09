import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "@/lib/api/client";

vi.mock("@/lib/api/client", () => ({
  api: { get: vi.fn(), put: vi.fn() },
}));

import { translationsApi } from "@/lib/api/translations";

describe("translationsApi", () => {
  beforeEach(() => vi.clearAllMocks());

  it("centralizes config and palette routes and disables retries for updates", async () => {
    vi.mocked(api.get).mockResolvedValueOnce({}).mockResolvedValueOnce([]);
    vi.mocked(api.put).mockResolvedValue({});

    await translationsApi.getConfig("project-1", "token");
    await translationsApi.getPalette();
    await translationsApi.updateConfig("project-1", {} as never, "token");

    expect(api.get).toHaveBeenNthCalledWith(
      1,
      "/api/v1/projects/project-1/translation/config",
      { headers: { Authorization: "Bearer token" } },
    );
    expect(api.get).toHaveBeenNthCalledWith(2, "/api/v1/translation/palette");
    expect(api.put).toHaveBeenCalledWith(
      "/api/v1/projects/project-1/translation/config",
      expect.anything(),
      { headers: { Authorization: "Bearer token" }, retryOn5xx: false },
    );
  });
});
