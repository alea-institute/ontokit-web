import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LLMSettingsSection } from "@/components/projects/LLMSettingsSection";
import type { LLMConfigResponse, LLMKnownModel } from "@/lib/api/llm";

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

const hookState = vi.hoisted(() => ({
  config: null as LLMConfigResponse | null,
  knownModels: [] as LLMKnownModel[],
  isModelsLoading: false,
  modelsError: null as Error | null,
}));

vi.mock("@/lib/hooks/useLLMConfig", () => ({
  useLLMConfig: () => ({
    config: hookState.config,
    knownModels: hookState.knownModels,
    isLoading: false,
    isModelsLoading: hookState.isModelsLoading,
    modelsError: hookState.modelsError,
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
  beforeEach(() => {
    updateConfig.mockReset().mockResolvedValue({});
    hookState.config = config;
    hookState.knownModels = knownModels;
    hookState.isModelsLoading = false;
    hookState.modelsError = null;
  });

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

  it("clears a model when the provider changes", async () => {
    const user = userEvent.setup();
    render(<LLMSettingsSection projectId="project-1" accessToken="token" />);

    await user.selectOptions(screen.getByRole("combobox", { name: /generation model/i }), "gpt-5-mini");
    await user.click(screen.getByRole("button", { name: /llm provider/i }));
    await user.click(screen.getByRole("option", { name: /anthropic/i }));

    expect((screen.getByRole("combobox", { name: /generation model/i }) as HTMLSelectElement).value).toBe("");
    expect((screen.getByRole("button", { name: /save ai settings/i }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("shows a disabled model select while registry models load", () => {
    hookState.knownModels = [];
    hookState.isModelsLoading = true;

    render(<LLMSettingsSection projectId="project-1" accessToken="token" />);

    expect((screen.getByRole("combobox", { name: /generation model/i }) as HTMLSelectElement).disabled).toBe(true);
    expect(screen.queryByRole("textbox", { name: /generation model/i })).toBeNull();
  });

  it("surfaces registry failures without degrading to free text", () => {
    hookState.knownModels = [];
    hookState.modelsError = new Error("registry unavailable");

    render(<LLMSettingsSection projectId="project-1" accessToken="token" />);

    expect(screen.getByRole("alert").textContent).toMatch(/could not load.*model/i);
    expect((screen.getByRole("combobox", { name: /generation model/i }) as HTMLSelectElement).disabled).toBe(true);
    expect(screen.queryByRole("textbox", { name: /generation model/i })).toBeNull();
  });

  it("offers a custom-model escape for a saved model missing from the registry", () => {
    hookState.config = { ...config, model: "gpt-private-deployment" };

    render(<LLMSettingsSection projectId="project-1" accessToken="token" />);

    expect((screen.getByRole("textbox", { name: /generation model/i }) as HTMLInputElement).value).toBe("gpt-private-deployment");
    expect(screen.getByRole("button", { name: /choose a registry model/i })).toBeTruthy();
    expect((screen.getByRole("button", { name: /save ai settings/i }) as HTMLButtonElement).disabled).toBe(false);
  });
});
