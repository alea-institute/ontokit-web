import { beforeEach, describe, expect, it, vi } from "vitest";
import { render as rtlRender, screen, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import userEvent from "@testing-library/user-event";
import type { TranslationConfigResponse } from "@/lib/api/translations";
import { TranslationSettingsSection } from "@/components/projects/TranslationSettingsSection";

function render(ui: React.ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return rtlRender(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

vi.hoisted(() => {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  HTMLElement.prototype.scrollIntoView = vi.fn();
});

const { updateConfig, listReviewers, updateReviewer, listMembers } = vi.hoisted(() => ({
  updateConfig: vi.fn(),
  listReviewers: vi.fn(),
  updateReviewer: vi.fn(),
  listMembers: vi.fn(),
}));
const state = vi.hoisted(() => ({
  isLoading: false,
  error: null as Error | null,
  isUpdating: false,
  updateError: null as Error | null,
}));

const config: TranslationConfigResponse = {
  language_tags: ["fr"],
  verification_mechanism: "consensus",
  consensus_threshold: 0.8,
  confidence_threshold: 0.9,
  translate_definitions: true,
  translate_examples: false,
  speed_mode: "batch",
  provisional_gate: true,
  primary_provider: "anthropic",
  primary_model: "claude-sonnet-4-5",
  verifier_provider: "openai",
  verifier_model: "gpt-5-mini",
  verifier_api_key_set: true,
};

vi.mock("@/lib/hooks/useTranslationConfig", () => ({
  useTranslationConfig: () => ({
    config,
    palette: [
      { tag: "fr", english_name: "French", native_name: "Français" },
      { tag: "es", english_name: "Spanish", native_name: "Español" },
    ],
    isLoading: state.isLoading,
    error: state.error,
    updateConfig,
    isUpdating: state.isUpdating,
    updateError: state.updateError,
  }),
}));
vi.mock("@/lib/api/translations", () => ({
  translationsApi: { listReviewers, updateReviewer },
  getTranslationErrorMessage: (error: unknown, fallback: string) => error instanceof Error ? error.message : fallback,
}));
vi.mock("@/lib/api/projects", () => ({ projectApi: { listMembers } }));

describe("TranslationSettingsSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.isLoading = false;
    state.error = null;
    state.isUpdating = false;
    state.updateError = null;
    updateConfig.mockResolvedValue(config);
    listReviewers.mockResolvedValue([]);
    updateReviewer.mockImplementation((_projectId, memberId, languages) => Promise.resolve({ member_id: memberId, user_id: "user-1", languages }));
    listMembers.mockResolvedValue({ items: [], total: 0 });
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
      expect.objectContaining({ language_tags: ["es", "grc"] }),
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

  it("allows an empty primary model, shows the required-to-run hint, and saves both primary fields", async () => {
    const user = userEvent.setup();
    render(<TranslationSettingsSection projectId="project-1" accessToken="token" canManage />);

    const provider = screen.getByLabelText(/primary provider/i) as HTMLInputElement;
    const model = screen.getByLabelText(/primary model/i) as HTMLInputElement;
    await user.clear(provider);
    await user.clear(model);

    expect(screen.getByText(/project's LLM provider/i)).toBeDefined();
    expect(screen.getByText(/primary model is required for translation to run/i)).toBeDefined();
    expect((screen.getByRole("button", { name: /save translation settings/i }) as HTMLButtonElement).disabled).toBe(false);

    await user.click(screen.getByRole("button", { name: /save translation settings/i }));
    expect(updateConfig).toHaveBeenCalledWith(
      expect.objectContaining({ primary_provider: null, primary_model: null }),
    );
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

  it("lists project members and updates reviewer languages", async () => {
    const user = userEvent.setup();
    listMembers.mockResolvedValue({ items: [{ id: "member-1", project_id: "project-1", user_id: "user-1", role: "editor", user: { id: "user-1", name: "Ada Reviewer" }, created_at: "2026-08-09" }], total: 1 });
    listReviewers.mockResolvedValue([{ member_id: "member-1", user_id: "user-1", languages: ["fr"] }]);
    render(<TranslationSettingsSection projectId="project-1" accessToken="token" canManage />);

    expect(await screen.findByText("Ada Reviewer")).toBeDefined();
    await user.click(screen.getByRole("button", { name: /remove fr from ada reviewer/i }));
    const reviewer = screen.getByText("Ada Reviewer").parentElement!;
    await user.click(within(reviewer).getByLabelText("Language tag for Ada Reviewer"));
    await user.type(within(reviewer).getByPlaceholderText("Search languages..."), "es");
    await user.click(await screen.findByText("Spanish"));
    await user.click(within(reviewer).getByRole("button", { name: "Add" }));
    await user.click(within(reviewer).getByRole("button", { name: /save reviewer/i }));
    expect(updateReviewer).toHaveBeenCalledWith("project-1", "member-1", ["es"], "token");
  });

  it("renders no card for a non-admin", () => {
    const { container } = render(
      <TranslationSettingsSection projectId="project-1" accessToken="token" canManage={false} />,
    );
    expect(container.innerHTML).toBe("");
  });
});
