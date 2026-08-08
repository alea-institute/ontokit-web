import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LLMSettingsSection } from "@/components/projects/LLMSettingsSection";

const updateConfig = vi.fn();
const config = {
  provider: "openai" as const,
  model: null,
  model_tier: "quality" as const,
  api_key_set: true,
  base_url: null,
  monthly_budget_usd: null,
  daily_cap_usd: null,
};
const knownModels = [
  { provider: "openai" as const, model_id: "gpt-5-mini", display_name: "GPT-5 mini", tier: "cheap" as const },
  { provider: "anthropic" as const, model_id: "claude-sonnet-4", display_name: "Claude Sonnet 4", tier: "quality" as const },
];

vi.mock("@/lib/hooks/useLLMConfig", () => ({
  useLLMConfig: () => ({
    config,
    knownModels,
    isLoading: false,
    isModelsLoading: false,
    updateConfig,
    isUpdating: false,
    testConnection: vi.fn(),
  }),
}));

vi.mock("@/lib/stores/byoKeyStore", () => ({
  useByoKeyStore: () => ({
    getEntry: vi.fn(),
    setKey: vi.fn(),
    clearKey: vi.fn(),
    markValidated: vi.fn(),
  }),
}));

describe("LLMSettingsSection", () => {
  beforeEach(() => updateConfig.mockReset().mockResolvedValue({}));

  it("requires and submits an exact generation model", async () => {
    const user = userEvent.setup();
    render(<LLMSettingsSection projectId="project-1" accessToken="token" />);

    const model = screen.getByRole("combobox", { name: /generation model/i });
    await user.selectOptions(model, "gpt-5-mini");
    await user.click(screen.getByRole("button", { name: /save ai settings/i }));

    expect(updateConfig).toHaveBeenCalledWith(
      expect.objectContaining({ provider: "openai", model: "gpt-5-mini" }),
    );
  });
});
