import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "@/lib/api/client";

vi.mock("@/lib/api/client", () => ({
  api: {
    get: vi.fn(),
  },
}));

import { llmApi } from "@/lib/api/llm";

const mockGet = vi.mocked(api.get);

describe("llmApi", () => {
  beforeEach(() => {
    mockGet.mockReset();
  });

  it("does not retry known-models 5xx responses inside the API client", async () => {
    mockGet.mockResolvedValue([]);

    await llmApi.getKnownModels();

    expect(mockGet).toHaveBeenCalledWith("/api/v1/llm/known-models", {
      retryOn5xx: false,
    });
  });
});
