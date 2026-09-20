import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { LLMSettingsSection } from "@/components/projects/LLMSettingsSection";
import { useByoKeyStore } from "@/lib/stores/byoKeyStore";
import type { LLMConfigResponse, LLMConfigUpdate, LLMKnownModel } from "@/lib/api/llm";

const initialConfig: LLMConfigResponse = {
  provider: "openai", model: "test-model", model_tier: "quality", api_key_set: true,
  base_url: null, monthly_budget_usd: 30, daily_cap_usd: 2,
};
const models: LLMKnownModel[] = [{ provider: "openai", model_id: "test-model", display_name: "Test model", tier: "quality" }];
const clients: QueryClient[] = [];
const response = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status });
function setup(options: {
  config?: LLMConfigResponse | null;
  connection?: () => Promise<Response>;
  save?: () => Promise<Response>;
  registry?: () => Promise<Response>;
  token?: string | null;
} = {}) {
  let config = options.config === undefined ? { ...initialConfig } : options.config;
  const updates: LLMConfigUpdate[] = [];
  const validations: Headers[] = [];
  const fetchMock = vi.fn<typeof fetch>(async (input, init) => {
    const path = new URL(String(input)).pathname;
    if (path.endsWith("/known-models")) return options.registry?.() ?? response(models);
    expect(new Headers(init?.headers).get("Authorization")).toBe("Bearer test-token");
    if (path.endsWith("/test-connection")) {
      validations.push(new Headers(init?.headers));
      return options.connection?.() ?? response({ success: true });
    }
    if (path.endsWith("/config") && init?.method === "PUT") {
      const update = JSON.parse(String(init.body)) as LLMConfigUpdate;
      updates.push(update);
      if (options.save) return options.save();
      config = { ...initialConfig, ...update, model: update.model ?? null };
      return response(config);
    }
    if (path.endsWith("/config")) return config ? response(config) : response({ detail: "Not configured" }, 404);
    throw new Error(`Unexpected request ${path}`);
  });
  vi.stubGlobal("fetch", fetchMock);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  clients.push(client);
  render(<QueryClientProvider client={client}><LLMSettingsSection projectId="settings-coverage" accessToken={options.token === null ? undefined : "test-token"} /></QueryClientProvider>);
  return { updates, validations, fetchMock };
}
const save = () => fireEvent.click(screen.getByRole("button", { name: "Save AI Settings" }));
const change = (label: string | RegExp, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
async function ready() { await screen.findByLabelText("API Key"); }
function provider(name: string) {
  fireEvent.click(screen.getByRole("button", { name: "LLM Provider" }));
  fireEvent.click(screen.getByRole("option", { name }));
}

beforeEach(() => { useByoKeyStore.getState().clearAll(); });
afterEach(() => { cleanup(); clients.splice(0).forEach(client => client.clear()); vi.useRealTimers(); vi.unstubAllGlobals(); useByoKeyStore.getState().clearAll(); });

describe("LLM settings through the real hook, API client, and BYO store", () => {
  it("validates a trimmed replacement key then saves budgets and tier and reloads config", async () => {
    const { updates, validations, fetchMock } = setup();
    await ready();
    expect(screen.getByLabelText("API Key").getAttribute("placeholder")).toBe("Key is set (enter new key to replace)");
    change("API Key", "  synthetic-replacement  ");
    change(/Monthly budget/, "0");
    change(/Daily sub-cap/, "1.5");
    fireEvent.click(screen.getByLabelText("Cheap"));
    save();
    await screen.findByText("AI settings saved.");
    expect(validations[0].get("X-BYO-API-Key")).toBe("synthetic-replacement");
    expect(updates).toEqual([{ provider: "openai", model: "test-model", model_tier: "cheap", api_key: "synthetic-replacement", base_url: null, monthly_budget_usd: 0, daily_cap_usd: 1.5 }]);
    expect((screen.getByLabelText("API Key") as HTMLInputElement).value).toBe(String(""));
    expect(fetchMock.mock.calls.filter(([input, init]) => String(input).endsWith("/config") && init?.method === "GET")).toHaveLength(2);
  });

  it("persists a switch from cheap to quality without replacing the stored API key", async () => {
    const { updates, validations } = setup({ config: { ...initialConfig, model_tier: "cheap" } });
    await ready();
    expect((screen.getByLabelText("Cheap") as HTMLInputElement).checked).toBe(true);
    fireEvent.click(screen.getByLabelText("Quality"));
    save();
    await screen.findByText("AI settings saved.");
    expect(updates).toHaveLength(1);
    expect(updates[0]).toMatchObject({ model_tier: "quality", model: "test-model" });
    expect(updates[0]).not.toHaveProperty("api_key");
    expect(validations).toHaveLength(0);
    expect((screen.getByLabelText("Quality") as HTMLInputElement).checked).toBe(true);
  });

  it("restores a session BYO key, validates it in the header, and never saves it in the config body", async () => {
    useByoKeyStore.getState().setKey("settings-coverage", "openai", "synthetic-session");
    const { updates, validations } = setup();
    await ready();
    expect((screen.getByLabelText("BYO API key") as HTMLInputElement).value).toBe(String("synthetic-session"));
    change("BYO API key", "  synthetic-new-session  ");
    save();
    await screen.findByText("Key valid");
    await screen.findByText("AI settings saved.");
    expect(validations[0].get("X-BYO-API-Key")).toBe("synthetic-new-session");
    expect(updates[0]).not.toHaveProperty("api_key");
    expect(useByoKeyStore.getState().getEntry("settings-coverage")).toEqual({ provider: "openai", key: "synthetic-new-session", validatedAt: expect.any(String) });
    fireEvent.click(screen.getByLabelText("Use my own API key (BYO)"));
    expect(useByoKeyStore.getState().getKey("settings-coverage")).toBeNull();
    expect(screen.queryByLabelText("BYO API key")).toBeNull();
  });

  it.each([
    ["provider error", () => Promise.resolve(response({ success: false, error: "Quota denied" })), "Quota denied"],
    ["missing error", () => Promise.resolve(response({ success: false })), "This API key was rejected by OpenAI"],
    ["transport error", () => Promise.reject(new Error("offline")), "Could not reach OpenAI"],
  ] as const)("blocks persistence on %s and clears the error when editing the key", async (_name, connection, message) => {
    const { updates } = setup({ connection });
    await ready();
    change("API Key", "synthetic-invalid");
    save();
    await screen.findByText(new RegExp(message));
    expect(updates).toHaveLength(0);
    change("API Key", "synthetic-corrected");
    expect(screen.queryByText(new RegExp(message))).toBeNull();
  });

  it.each([
    [new Error("Write refused"), "Write refused"],
    ["non-error rejection", "Settings could not be saved. Try again, or reload the page if the problem continues."],
  ])("shows save failure without clearing the form: %s", async (failure, message) => {
    const { updates } = setup({ save: () => Promise.reject(failure) });
    await ready();
    change(/Monthly budget/, "15");
    save();
    await screen.findByText(String(message));
    expect(updates).toHaveLength(1);
    expect((screen.getByLabelText(/Monthly budget/) as HTMLInputElement).value).toBe(String(15));
    expect(screen.queryByText("AI settings saved.")).toBeNull();
  });

  it.each([
    ["Ollama (local)", "ollama", "http://localhost:11434"],
    ["LM Studio (local)", "lmstudio", "http://localhost:1234"],
    ["Llamafile (local)", "llamafile", "http://localhost:8080"],
    ["Custom endpoint", "custom", ""],
  ])("saves %s with a free-text model and explicit endpoint", async (label, value, endpoint) => {
    const { updates, validations } = setup();
    await ready();
    provider(label);
    expect(screen.queryByLabelText("API Key")).toBeNull();
    expect((screen.getByLabelText("Endpoint URL") as HTMLInputElement).value).toBe(String(endpoint));
    expect((screen.getByRole("button", { name: "Save AI Settings" }) as HTMLButtonElement).disabled).toBe(true);
    change("Generation model", "local-model");
    change("Endpoint URL", " http://localhost:19000 ");
    change(/Monthly budget/, "");
    change(/Daily sub-cap/, "");
    save();
    await screen.findByText("AI settings saved.");
    expect(updates[0]).toMatchObject({ provider: value, model: "local-model", base_url: "http://localhost:19000", monthly_budget_usd: null, daily_cap_usd: null });
    expect(validations).toHaveLength(0);
  });

  it("allows replacing an obsolete saved model with a registry model", async () => {
    const { updates } = setup({ config: { ...initialConfig, model: "obsolete-private-model" } });
    await ready();
    change("Generation model", "private-v2");
    expect((screen.getByLabelText("Generation model") as HTMLInputElement).value).toBe(String("private-v2"));
    fireEvent.click(screen.getByRole("button", { name: "Choose a registry model" }));
    expect((screen.getByRole("combobox", { name: "Generation model" }) as HTMLInputElement).value).toBe(String(""));
    expect((screen.getByRole("button", { name: "Save AI Settings" }) as HTMLButtonElement).disabled).toBe(true);
    change("Generation model", "test-model");
    save();
    await screen.findByText("AI settings saved.");
    expect(updates[0].model).toBe("test-model");
  });

  it("opens and bounds keyboard selection, supports hover, Escape, and outside dismissal", async () => {
    setup(); await ready();
    const trigger = screen.getByRole("button", { name: "LLM Provider" });
    fireEvent.keyDown(trigger, { key: "Tab" });
    expect(screen.queryByRole("listbox")).toBeNull();
    fireEvent.keyDown(trigger, { key: " " });
    fireEvent.keyDown(trigger, { key: "ArrowUp" });
    expect(screen.getByRole("option", { name: "OpenAI" }).getAttribute("data-focused")).toBe("true");
    for (let i = 0; i < 15; i++) fireEvent.keyDown(trigger, { key: "ArrowDown" });
    expect(screen.getByRole("option", { name: "Custom endpoint" }).getAttribute("data-focused")).toBe("true");
    fireEvent.keyDown(trigger, { key: "Enter" });
    expect((screen.getByLabelText("Endpoint URL") as HTMLInputElement).value).toBe(String(""));
    fireEvent.keyDown(trigger, { key: "Enter" });
    fireEvent.mouseEnter(screen.getByRole("option", { name: "Google" }));
    fireEvent.keyDown(trigger, { key: "Enter" });
    expect(trigger.textContent).toContain("Google");
    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    fireEvent.keyDown(trigger, { key: "Escape" });
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(trigger);
    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("masks and reveals a typed key without changing its value", async () => {
    setup(); await ready(); change("API Key", "synthetic-visible");
    fireEvent.click(screen.getByRole("button", { name: "Show API key" }));
    expect(screen.getByLabelText("API Key").getAttribute("type")).toBe("text");
    fireEvent.click(screen.getByRole("button", { name: "Hide API key" }));
    expect(screen.getByLabelText("API Key").getAttribute("type")).toBe("password");
    expect((screen.getByLabelText("API Key") as HTMLInputElement).value).toBe(String("synthetic-visible"));
  });

  it("creates the first configuration after a 404", async () => {
    const { updates } = setup({ config: null }); await ready();
    expect(screen.getByText("No AI provider configured")).toBeTruthy();
    change("Generation model", "test-model"); save();
    await screen.findByText("AI settings saved.");
    await waitFor(() => expect(screen.queryByText("No AI provider configured")).toBeNull());
    expect(updates[0]).toMatchObject({ monthly_budget_usd: null, daily_cap_usd: null });
  });

  it("does not write settings without an access token", async () => {
    const { updates, fetchMock } = setup({ token: null }); await ready();
    await screen.findByRole("option", { name: "Test model (quality)" });
    change("Generation model", "test-model"); save();
    expect(updates).toHaveLength(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("clears validation and success messages after their distinct delays", async () => {
    setup(); await ready();
    change("API Key", "synthetic-timer"); save();
    await screen.findByText("AI settings saved.");
    // Install fake timers before a second save so only this interaction's timers are controlled.
    vi.useFakeTimers();
    change("API Key", "synthetic-second");
    await act(async () => { save(); await vi.advanceTimersByTimeAsync(20); });
    expect(screen.getByText("Key valid")).toBeTruthy();
    await act(async () => { await vi.advanceTimersByTimeAsync(3000); });
    expect(screen.queryByText("AI settings saved.")).toBeNull();
    expect(screen.getByText("Key valid")).toBeTruthy();
    await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
    expect(screen.queryByText("Key valid")).toBeNull();
  });

  it("disables duplicate saves while validation and persistence are pending", async () => {
    let resolveConnection!: (response: Response) => void;
    let resolveSave!: (response: Response) => void;
    const { updates, validations } = setup({
      connection: () => new Promise(resolve => { resolveConnection = resolve; }),
      save: () => new Promise(resolve => { resolveSave = resolve; }),
    });
    await ready(); change("API Key", "synthetic-pending"); save();
    await screen.findByText("Validating...");
    expect((screen.getByRole("button", { name: "Save AI Settings" }) as HTMLButtonElement).disabled).toBe(true);
    save();
    expect(validations).toHaveLength(1);
    expect(updates).toHaveLength(0);
    await act(async () => { resolveConnection(response({ success: true })); });
    const pendingSave = await screen.findByRole("button", { name: "Saving..." });
    expect((pendingSave as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(pendingSave);
    expect(updates).toHaveLength(1);
    await act(async () => { resolveSave(response(initialConfig)); });
    await screen.findByText("AI settings saved.");
  });

  it("keeps the registry selector disabled until its response and exposes a fetch error", async () => {
    let resolveRegistry!: (response: Response) => void;
    setup({ registry: () => new Promise(resolve => { resolveRegistry = resolve; }) });
    await ready();
    expect(screen.getByRole("option", { name: "Loading models…" })).toBeTruthy();
    expect((screen.getByLabelText("Generation model") as HTMLSelectElement).disabled).toBe(true);
    await act(async () => { resolveRegistry(response({ detail: "Registry unavailable" }, 503)); });
    await screen.findByRole("alert");
    expect(screen.getByRole("option", { name: "Models unavailable" })).toBeTruthy();
    expect((screen.getByRole("button", { name: "Save AI Settings" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("requires an explicit model when the registry is empty for an unconfigured project", async () => {
    setup({ config: null, registry: async () => response([]) });
    await ready();
    expect(screen.getAllByRole("option")).toHaveLength(1);
    expect((screen.getByRole("button", { name: "Save AI Settings" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByRole("textbox", { name: "Generation model" })).toBeNull();
  });

});
