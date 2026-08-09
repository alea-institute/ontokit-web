import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { TranslationConfigResponse } from "@/lib/api/translations";
import { TranslationSettingsSection } from "@/components/projects/TranslationSettingsSection";

vi.hoisted(() => {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  HTMLElement.prototype.scrollIntoView = vi.fn();
});

const updateConfig = vi.fn();
const state = vi.hoisted(() => ({
  isLoading: false,
  error: null as Error | null,
  isUpdating: false,
  updateError: null as Error | null,
}));

const config: TranslationConfigResponse = {
  language_set: ["fr"],
  verification_mechanism: "consensus",
  consensus_threshold: 0.8,
  confidence_threshold: 0.9,
  translate_definitions: true,
  translate_examples: false,
  speed_mode: "batch",
  provisional_gate: true,
  verifier_provider: "openai",
  verifier_model: "gpt-5-mini",
  verifier_api_key_set: true,
};

vi.mock("@/lib/hooks/useTranslationConfig", () => ({
  useTranslationConfig: () => ({
    config,
    palette: [
      { tag: "fr", name: "French", native_name: "Français" },
      { tag: "es", name: "Spanish", native_name: "Español" },
    ],
    isLoading: state.isLoading,
    error: state.error,
    updateConfig,
    isUpdating: state.isUpdating,
    updateError: state.updateError,
  }),
}));

describe("TranslationSettingsSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.isLoading = false;
    state.error = null;
    state.isUpdating = false;
    state.updateError = null;
    updateConfig.mockResolvedValue(config);
  });

  it("renders the saved config without echoing the verifier key and starts pristine", () => {
    render(<TranslationSettingsSection projectId="project-1" accessToken="token" canManage />);

    expect(screen.getByText("French")).toBeDefined();
    expect((screen.getByLabelText(/verifier provider/i) as HTMLInputElement).value).toBe("openai");
    expect((screen.getByLabelText(/verifier API key/i) as HTMLInputElement).value).toBe("");
    expect(screen.getByText(/key is set/i)).toBeDefined();
    expect((screen.getByRole("button", { name: /save translation settings/i }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("adds palette and custom tags, removes a tag, and saves the resulting set", async () => {
    const user = userEvent.setup();
    render(<TranslationSettingsSection projectId="project-1" accessToken="token" canManage />);

    await user.click(screen.getByRole("button", { name: /add language/i }));
    await user.click(screen.getByRole("button", { name: /Spanish \(es\)/i }));
    await user.click(screen.getByRole("button", { name: /add selected language/i }));

    await user.click(screen.getByRole("button", { name: /add language/i }));
    await user.click(screen.getByLabelText("Language tag"));
    await user.type(screen.getByPlaceholderText("Search languages..."), "grc");
    await user.click(await screen.findByText(/Use custom code/));
    await user.click(screen.getByRole("button", { name: /add selected language/i }));
    await user.click(screen.getByRole("button", { name: /remove French/i }));
    await user.click(screen.getByRole("button", { name: /save translation settings/i }));

    expect(updateConfig).toHaveBeenCalledWith(
      expect.objectContaining({ language_set: ["es", "grc"] }),
    );
  });

  it("preserves values after a failed save and shows field validation", async () => {
    const user = userEvent.setup();
    updateConfig.mockRejectedValue(new Error("Provider rejected the model"));
    render(<TranslationSettingsSection projectId="project-1" accessToken="token" canManage />);

    const model = screen.getByLabelText(/verifier model/i) as HTMLInputElement;
    await user.clear(model);
    expect(screen.getByText(/verifier model is required/i)).toBeDefined();
    expect((screen.getByRole("button", { name: /save translation settings/i }) as HTMLButtonElement).disabled).toBe(true);

    await user.type(model, "bad-model");
    await user.click(screen.getByRole("button", { name: /save translation settings/i }));
    expect((await screen.findByRole("alert")).textContent).toContain("Provider rejected the model");
    expect(model.value).toBe("bad-model");
  });

  it("operates grouped controls from the keyboard", async () => {
    const user = userEvent.setup();
    render(<TranslationSettingsSection projectId="project-1" accessToken="token" canManage />);

    const confidence = screen.getByRole("radio", { name: /confidence/i });
    confidence.focus();
    await user.keyboard(" ");
    expect((confidence as HTMLInputElement).checked).toBe(true);
    await user.tab();
    expect(document.activeElement).not.toBe(document.body);
  });

  it("renders no card for a non-admin", () => {
    const { container } = render(
      <TranslationSettingsSection projectId="project-1" accessToken="token" canManage={false} />,
    );
    expect(container.innerHTML).toBe("");
  });
});
