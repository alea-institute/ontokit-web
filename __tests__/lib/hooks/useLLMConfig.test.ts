import React, { type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { llmApi } from "@/lib/api/llm";
import { useLLMConfig } from "@/lib/hooks/useLLMConfig";

vi.mock("@/lib/api/llm", () => ({
  llmApi: {
    getConfig: vi.fn(),
    getKnownModels: vi.fn(),
    updateConfig: vi.fn(),
    testConnection: vi.fn(),
  },
}));

const mockGetConfig = vi.mocked(llmApi.getConfig);
const mockGetKnownModels = vi.mocked(llmApi.getKnownModels);

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: 3, retryDelay: 0 } },
  });

  return function QueryTestWrapper({ children }: { children: ReactNode }) {
    return React.createElement(
      QueryClientProvider,
      { client: queryClient },
      children
    );
  };
}

describe("useLLMConfig", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetConfig.mockResolvedValue({
      provider: "openai",
      model: "gpt-4o",
      model_tier: "quality",
      api_key_set: true,
      base_url: null,
      monthly_budget_usd: null,
      daily_cap_usd: null,
    });
  });

  it("surfaces a known-models failure without React Query retries", async () => {
    mockGetKnownModels.mockRejectedValue(new Error("registry unavailable"));

    const { result } = renderHook(
      () => useLLMConfig("proj-1", "token-123"),
      { wrapper: createWrapper() }
    );

    await waitFor(() =>
      expect(result.current.modelsError).toEqual(
        new Error("registry unavailable")
      )
    );
    expect(mockGetKnownModels).toHaveBeenCalledTimes(1);
  });
});
