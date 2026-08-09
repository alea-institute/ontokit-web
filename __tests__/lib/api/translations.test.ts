import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "@/lib/api/client";

vi.mock("@/lib/api/client", () => ({
  api: { get: vi.fn(), put: vi.fn() },
}));

import { translationsApi } from "@/lib/api/translations";
import type { TranslationConfigResponse, TranslationConfigUpdate } from "@/lib/api/translations";

const config: TranslationConfigResponse = {
  language_set: ["fr"],
  verification_mechanism: "consensus",
  consensus_threshold: 0.8,
  confidence_threshold: 0.9,
  translate_definitions: true,
  translate_examples: false,
  speed_mode: "batch",
  provisional_gate: true,
  primary_provider: null,
  primary_model: "gpt-5-mini",
  verifier_provider: null,
  verifier_model: null,
  verifier_api_key_set: false,
};

describe("translationsApi", () => {
  beforeEach(() => vi.clearAllMocks());

  it("centralizes config and palette routes and disables retries for updates", async () => {
    const { verifier_api_key_set: _keySet, ...editableConfig } = config;
    const update: TranslationConfigUpdate = {
      ...editableConfig,
      primary_provider: "openai",
      primary_model: "gpt-5",
    };
    vi.mocked(api.get).mockResolvedValueOnce(config).mockResolvedValueOnce([]);
    vi.mocked(api.put).mockResolvedValue({ ...config, ...update });

    const received = await translationsApi.getConfig("project-1", "token");
    await translationsApi.getPalette();
    const saved = await translationsApi.updateConfig("project-1", update, "token");

    expect(received).toEqual(expect.objectContaining({ primary_provider: null, primary_model: "gpt-5-mini" }));
    expect(saved).toEqual(expect.objectContaining({ primary_provider: "openai", primary_model: "gpt-5" }));

    expect(api.get).toHaveBeenNthCalledWith(
      1,
      "/api/v1/projects/project-1/translation/config",
      { headers: { Authorization: "Bearer token" } },
    );
    expect(api.get).toHaveBeenNthCalledWith(2, "/api/v1/translation/palette");
    expect(api.put).toHaveBeenCalledWith(
      "/api/v1/projects/project-1/translation/config",
      expect.objectContaining({ primary_provider: "openai", primary_model: "gpt-5" }),
      { headers: { Authorization: "Bearer token" }, retryOn5xx: false },
    );
  });
});
