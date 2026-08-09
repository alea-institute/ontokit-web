import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "@/lib/api/client";

vi.mock("@/lib/api/client", () => ({
  api: { get: vi.fn(), put: vi.fn(), post: vi.fn() },
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

  it("centralizes entity state and on-demand field translation routes", async () => {
    vi.mocked(api.get).mockResolvedValue({ entity_iri: "ex:Person", branch: "dev", items: [] });
    vi.mocked(api.post).mockResolvedValue({ job_id: "job-1" });

    await translationsApi.getEntityState("project-1", "ex:Person", "dev", "token");
    await translationsApi.translateField(
      "project-1",
      { entity_iri: "ex:Person", predicate: "skos:definition", branch: "dev" },
      "token",
    );

    expect(api.get).toHaveBeenCalledWith(
      "/api/v1/projects/project-1/translation/entity-state",
      {
        headers: { Authorization: "Bearer token" },
        params: { entity_iri: "ex:Person", branch: "dev" },
      },
    );
    expect(api.post).toHaveBeenCalledWith(
      "/api/v1/projects/project-1/translation/entities/translate-field",
      { entity_iri: "ex:Person", predicate: "skos:definition", branch: "dev" },
      { headers: { Authorization: "Bearer token" }, retryOn5xx: false },
    );
  });

  it("centralizes coverage and backfill routes and sends era filters without retries", async () => {
    vi.mocked(api.get).mockResolvedValue({ languages: [], total_entities: 0 });
    vi.mocked(api.post).mockResolvedValue({ job_id: "job-1" });

    await translationsApi.getCoverage("project-1", "feature/translations", "token");
    await translationsApi.previewBackfill(
      "project-1",
      {
        branch: "feature/translations",
        language: "fr",
        era_before: "2026-12-31",
        never_confirmed: true,
      },
      "token",
    );
    await translationsApi.launchBackfill(
      "project-1",
      {
        branch: "feature/translations",
        language: "fr",
        era_before: "2026-12-31",
        never_confirmed: true,
      },
      "token",
    );
    await translationsApi.getBackfillStatus("project-1", "feature/translations", "token");

    expect(api.get).toHaveBeenNthCalledWith(
      1,
      "/api/v1/projects/project-1/translation/coverage",
      expect.objectContaining({ params: { branch: "feature/translations" } }),
    );
    expect(api.get).toHaveBeenNthCalledWith(
      2,
      "/api/v1/projects/project-1/translation/backfill/preview",
      expect.objectContaining({
        params: {
          branch: "feature/translations",
          language: "fr",
          era_before: "2026-12-31",
          never_confirmed: true,
        },
      }),
    );
    expect(api.post).toHaveBeenCalledWith(
      "/api/v1/projects/project-1/translation/backfill",
      {
        branch: "feature/translations",
        language: "fr",
        era_before: "2026-12-31",
        never_confirmed: true,
      },
      { headers: { Authorization: "Bearer token" }, retryOn5xx: false },
    );
    expect(api.get).toHaveBeenNthCalledWith(
      3,
      "/api/v1/projects/project-1/translation/backfill/status",
      expect.objectContaining({ params: { branch: "feature/translations" } }),
    );
  });

  it("centralizes reviewer queue routes and disables retries for every actuation", async () => {
    vi.mocked(api.get).mockResolvedValue([]);
    vi.mocked(api.post).mockResolvedValue({ record_id: "record-1" });

    await translationsApi.listProvisional("project-1", "sw", "main", "token");
    await translationsApi.getMyReviewerLanguages("project-1", "token");
    await translationsApi.confirmRecord("project-1", "record-1", "main", "token");
    await translationsApi.rejectRecord("project-1", "record-1", "main", "token");
    await translationsApi.confirmBulk("project-1", ["record-1", "record-2"], "main", "token");

    expect(api.get).toHaveBeenNthCalledWith(
      1,
      "/api/v1/projects/project-1/translation/provisional",
      { headers: { Authorization: "Bearer token" }, params: { language: "sw", branch: "main" } },
    );
    expect(api.get).toHaveBeenNthCalledWith(
      2,
      "/api/v1/projects/project-1/translation/my-reviewer-languages",
      { headers: { Authorization: "Bearer token" } },
    );
    const actuationOptions = { headers: { Authorization: "Bearer token" }, retryOn5xx: false };
    expect(api.post).toHaveBeenNthCalledWith(
      1,
      "/api/v1/projects/project-1/translation/records/record-1/confirm",
      { branch: "main" },
      actuationOptions,
    );
    expect(api.post).toHaveBeenNthCalledWith(
      2,
      "/api/v1/projects/project-1/translation/records/record-1/reject",
      { branch: "main" },
      actuationOptions,
    );
    expect(api.post).toHaveBeenNthCalledWith(
      3,
      "/api/v1/projects/project-1/translation/records/confirm-bulk",
      { branch: "main", record_ids: ["record-1", "record-2"] },
      actuationOptions,
    );
  });
});
