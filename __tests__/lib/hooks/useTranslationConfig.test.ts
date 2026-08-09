import React, { type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { translationsApi } from "@/lib/api/translations";
import { translationQueryKeys, useTranslationConfig } from "@/lib/hooks/useTranslationConfig";

vi.mock("@/lib/api/translations", () => ({
  translationsApi: {
    getConfig: vi.fn(),
    getPalette: vi.fn(),
    updateConfig: vi.fn(),
  },
}));

function config() {
  return {
    language_set: ["fr"],
    verification_mechanism: "consensus" as const,
    consensus_threshold: 0.8,
    confidence_threshold: 0.9,
    translate_definitions: true,
    translate_examples: false,
    speed_mode: "batch" as const,
    provisional_gate: true,
    verifier_provider: null,
    verifier_model: null,
    verifier_api_key_set: false,
  };
}

describe("useTranslationConfig", () => {
  it("loads config and palette, then invalidates config after a save", async () => {
    vi.mocked(translationsApi.getConfig).mockResolvedValue(config());
    vi.mocked(translationsApi.getPalette).mockResolvedValue([
      { tag: "fr", name: "French", native_name: "Français" },
    ]);
    vi.mocked(translationsApi.updateConfig).mockResolvedValue(config());
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidate = vi.spyOn(client, "invalidateQueries");
    const wrapper = ({ children }: { children: ReactNode }) =>
      React.createElement(QueryClientProvider, { client }, children);

    const { result } = renderHook(
      () => useTranslationConfig("project-1", "token"),
      { wrapper },
    );
    await waitFor(() => expect(result.current.config).toEqual(config()));
    expect(result.current.palette).toHaveLength(1);

    await act(() => result.current.updateConfig(config()));

    expect(invalidate).toHaveBeenCalledWith({
      queryKey: translationQueryKeys.config("project-1"),
    });
  });
});
