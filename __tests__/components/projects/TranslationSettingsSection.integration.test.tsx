import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TranslationSettingsSection } from "@/components/projects/TranslationSettingsSection";
import type { TranslationConfigResponse } from "@/lib/api/translations";
import { jsonResponse, llmHookHarness } from "../../fixtures/llm-hook-harness";

const scrollDescriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "scrollIntoView");
const initial: TranslationConfigResponse = {
  language_tags: ["fr"], verification_mechanism: "consensus", consensus_threshold: 0.8,
  confidence_threshold: 0.9, translate_definitions: true, translate_examples: false,
  speed_mode: "batch", provisional_gate: true, primary_provider: "test-provider",
  primary_model: "test-model", verifier_provider: null, verifier_model: null, verifier_api_key_set: false,
};
let config: TranslationConfigResponse;
let failPath: string | undefined;
let failSave: boolean;
let saveGate: Promise<void> | undefined;
let reviewers: { member_id: string; user_id: string; languages: string[] }[];
let members: { id: string; user_id: string; user?: { name?: string; email?: string } }[];
let requests: { path: string; method: string; body?: Record<string, unknown>; authorization: string | null }[];
const clients: ReturnType<typeof llmHookHarness>["client"][] = [];
function mount(canManage = true, accessToken: string | undefined = "test-token") {
  const { client, wrapper } = llmHookHarness(); clients.push(client);
  return render(<TranslationSettingsSection projectId="p" accessToken={accessToken} canManage={canManage} />, { wrapper });
}
beforeEach(() => {
  config = { ...initial }; failPath = undefined; failSave = false; saveGate = undefined; members = []; reviewers = []; requests = [];
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", { configurable: true, value: vi.fn() });
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = new URL(String(input)).pathname; const method = init?.method ?? "GET";
    const body = init?.body ? JSON.parse(String(init.body)) as Record<string, unknown> : undefined;
    requests.push({ path, method, body, authorization: new Headers(init?.headers).get("Authorization") });
    if (path === failPath || (method === "PUT" && failSave)) return jsonResponse({ detail: "Settings rejected" }, 422);
    if (method === "PUT" && saveGate) await saveGate;
    if (path.endsWith("/palette")) return jsonResponse([{ tag: "fr", english_name: "French", native_name: "Français" }, { tag: "es", english_name: "Spanish", native_name: "Español" }]);
    if (path.endsWith("/config")) {
      if (body) {
        const { verifier_api_key, ...editable } = body;
        config = { ...config, ...editable, verifier_api_key_set: verifier_api_key ? true : config.verifier_api_key_set };
      }
      return jsonResponse(config);
    }
    if (path.endsWith("/members")) return jsonResponse({ items: members, total: members.length });
    if (path.endsWith("/reviewers")) return jsonResponse(reviewers);
    if (path.includes("/reviewers/")) {
      const reviewer = { member_id: path.split("/").at(-1)!, user_id: "u", languages: body!.languages as string[] };
      reviewers = [...reviewers.filter(item => item.member_id !== reviewer.member_id), reviewer]; return jsonResponse(reviewer);
    }
    throw new Error(`Unexpected request ${method} ${path}`);
  }));
});
afterEach(() => { cleanup(); clients.splice(0).forEach(client => client.clear()); vi.restoreAllMocks(); vi.unstubAllGlobals(); if (scrollDescriptor) Object.defineProperty(HTMLElement.prototype, "scrollIntoView", scrollDescriptor); else Reflect.deleteProperty(HTMLElement.prototype, "scrollIntoView"); });

describe("translation settings through query and HTTP clients", () => {
  it("saves all verification controls, refreshes the query baseline and clears dirty state", async () => {
    mount(); await screen.findByLabelText("Primary model");
    fireEvent.click(screen.getByLabelText("confidence"));
    fireEvent.change(screen.getByLabelText("Confidence threshold"), { target: { value: "0.65" } });
    for (const name of ["Definitions", "Examples", "Require the provisional translation gate", "fast"]) fireEvent.click(screen.getByLabelText(name));
    fireEvent.change(screen.getByLabelText("Primary provider"), { target: { value: "" } });
    fireEvent.change(screen.getByLabelText("Primary model"), { target: { value: "" } });
    fireEvent.change(screen.getByLabelText("Verifier API key"), { target: { value: "fixture-only-key" } });
    fireEvent.click(screen.getByRole("button", { name: "Save translation settings" }));
    await screen.findByText("Translation settings saved.");
    const put = requests.find(r => r.method === "PUT")!;
    expect(put.authorization).toBe("Bearer test-token");
    expect(put.body).toMatchObject({ confidence_threshold: 0.65, verification_mechanism: "confidence", translate_definitions: false, translate_examples: true, provisional_gate: false, speed_mode: "fast", primary_provider: null, primary_model: null, verifier_api_key: "fixture-only-key" });
    expect(put.body).not.toHaveProperty("verifier_api_key_set");
    expect(requests.filter(r => r.path.endsWith("/config") && r.method === "GET").length).toBe(2);
    expect((screen.getByRole("button", { name: "Save translation settings" }) as HTMLButtonElement).disabled).toBe(true);
  });
  it("validates a verifier provider, persists its model and clears both back to project defaults", async () => {
    mount(); await screen.findByLabelText("Verifier provider");
    fireEvent.change(screen.getByLabelText("Verifier provider"), { target: { value: "verifier-provider" } });
    expect(screen.getByRole("alert").textContent).toBe("Verifier model is required when a provider is set.");
    expect((screen.getByRole("button", { name: "Save translation settings" }) as HTMLButtonElement).disabled).toBe(true);
    expect(requests.filter(r => r.method === "PUT")).toHaveLength(0);
    fireEvent.change(screen.getByLabelText("Verifier model"), { target: { value: "verifier-model" } });
    fireEvent.click(screen.getByRole("button", { name: "Save translation settings" }));
    await screen.findByText("Translation settings saved.");
    await waitFor(() => expect((screen.getByRole("button", { name: "Save translation settings" }) as HTMLButtonElement).disabled).toBe(true));
    expect(config).toMatchObject({ verifier_provider: "verifier-provider", verifier_model: "verifier-model" });
    fireEvent.change(screen.getByLabelText("Verifier provider"), { target: { value: "" } });
    fireEvent.change(screen.getByLabelText("Verifier model"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Save translation settings" }));
    await waitFor(() => expect(requests.filter(r => r.method === "PUT")).toHaveLength(2));
    await waitFor(() => expect((screen.getByRole("button", { name: "Save translation settings" }) as HTMLButtonElement).disabled).toBe(true));
    expect(requests.filter(r => r.method === "PUT").map(r => ({ provider: r.body?.verifier_provider, model: r.body?.verifier_model }))).toEqual([
      { provider: "verifier-provider", model: "verifier-model" }, { provider: null, model: null },
    ]);
    expect((screen.getByLabelText("Verifier provider") as HTMLInputElement).value).toBe("");
    expect((screen.getByLabelText("Verifier model") as HTMLInputElement).value).toBe("");
  });
  it("retains edited values after a server rejection and retries the same configuration", async () => {
    failSave = true; mount(); await screen.findByLabelText("Primary model");
    fireEvent.change(screen.getByLabelText("Primary model"), { target: { value: "new-model" } });
    fireEvent.click(screen.getByRole("button", { name: "Save translation settings" }));
    expect(await screen.findByText("Settings rejected")).toBeDefined();
    expect((screen.getByLabelText("Primary model") as HTMLInputElement).value).toBe("new-model");
    failSave = false; fireEvent.click(screen.getByRole("button", { name: "Save translation settings" }));
    await screen.findByText("Translation settings saved.");
    expect(requests.filter(r => r.method === "PUT").map(r => r.body?.primary_model)).toEqual(["new-model", "new-model"]);
  });
  it("blocks empty languages and out-of-range thresholds, then permits valid boundary values", async () => {
    mount(); await screen.findByLabelText("Consensus threshold");
    fireEvent.change(screen.getByLabelText("Consensus threshold"), { target: { value: "1.1" } });
    expect(screen.getByText("Threshold must be between 0 and 1.")).toBeDefined();
    fireEvent.change(screen.getByLabelText("Consensus threshold"), { target: { value: "0" } });
    fireEvent.click(screen.getByRole("button", { name: "Remove French" }));
    expect(screen.getByText("Add at least one valid BCP 47 language tag.")).toBeDefined();
    expect((screen.getByRole("button", { name: "Save translation settings" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Add language" }));
    fireEvent.click(screen.getByRole("button", { name: "Spanish (es)" }));
    fireEvent.click(screen.getByRole("button", { name: "Add selected language" }));
    fireEvent.click(screen.getByRole("button", { name: "Save translation settings" }));
    await screen.findByText("Translation settings saved.");
    expect(config).toMatchObject({ language_tags: ["es"], consensus_threshold: 0 });
  });
  it("cancels the language picker without changing the form", async () => {
    mount(); await screen.findByLabelText("Primary model");
    fireEvent.click(screen.getByRole("button", { name: "Add language" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByLabelText("Language palette")).toBeNull();
    expect((screen.getByRole("button", { name: "Save translation settings" }) as HTMLButtonElement).disabled).toBe(true);
  });
  it.each(["/api/v1/projects/p/translation/config", "/api/v1/translation/palette"])("renders the actual API error from %s", async path => {
    failPath = path; mount(); expect(await screen.findByText("Settings rejected")).toBeDefined();
  });
  it.each(["/api/v1/projects/p/members", "/api/v1/projects/p/translation/reviewers"])("shows reviewer loading failures from %s without losing the settings form", async path => {
    failPath = path; mount(); expect(await screen.findByText("Settings rejected")).toBeDefined();
    expect(screen.getByLabelText("Primary model")).toBeDefined();
  });
  it("uses fallback member identities and retries a failed reviewer assignment through refetch", async () => {
    members = [{ id: "m", user_id: "u", user: { email: "reviewer@example.test" } }, { id: "other", user_id: "fallback-id" }];
    mount(); const user = userEvent.setup(); await screen.findByText("reviewer@example.test");
    expect(screen.getByText("fallback-id")).toBeDefined();
    const row = within(screen.getByText("reviewer@example.test").parentElement!);
    await user.click(row.getByLabelText("Language tag for reviewer@example.test"));
    await user.type(screen.getByPlaceholderText("Search languages..."), "es");
    await user.click(await screen.findByText("Spanish"));
    await user.click(row.getByRole("button", { name: "Add" }));
    failSave = true; await user.click(row.getByRole("button", { name: "Save reviewer" }));
    expect((await row.findByRole("alert")).textContent).toBe("Settings rejected");
    failSave = false; await user.click(row.getByRole("button", { name: "Save reviewer" }));
    await row.findByText("Reviewer languages saved.");
    await waitFor(() => expect((row.getByRole("button", { name: "Save reviewer" }) as HTMLButtonElement).disabled).toBe(true));
    expect(requests.filter(r => r.path.endsWith("/reviewers/m")).map(r => r.body)).toEqual([{ languages: ["es"] }, { languages: ["es"] }]);
  });
  it("omits a cleared replacement key while persisting an unrelated configuration edit", async () => {
    config = { ...initial, verifier_api_key_set: true };
    mount(); await screen.findByLabelText("Verifier API key");
    fireEvent.change(screen.getByLabelText("Verifier API key"), { target: { value: "fixture-replacement" } });
    fireEvent.change(screen.getByLabelText("Verifier API key"), { target: { value: "" } });
    fireEvent.change(screen.getByLabelText("Primary model"), { target: { value: "updated-model" } });
    fireEvent.click(screen.getByRole("button", { name: "Save translation settings" }));
    await screen.findByText("Translation settings saved.");
    const saved = requests.find(request => request.method === "PUT")!;
    expect(saved.body?.primary_model).toBe("updated-model");
    expect(saved.body).not.toHaveProperty("verifier_api_key");
    expect(saved.body).not.toHaveProperty("verifier_api_key_set");
    expect(screen.getByText("A verifier key is set. Enter a new key only to replace it.")).toBeDefined();
    expect((screen.getByLabelText("Verifier API key") as HTMLInputElement).value).toBe("");
  });

  it("blocks an invalid saved language tag until it is removed from the configuration", async () => {
    config = { ...initial, language_tags: ["fr", "not_a_language"] };
    mount(); await screen.findByRole("button", { name: "Remove not_a_language" });
    fireEvent.change(screen.getByLabelText("Primary model"), { target: { value: "updated-model" } });
    expect(screen.getByText("Add at least one valid BCP 47 language tag.")).toBeDefined();
    expect(screen.getByRole("button", { name: "Save translation settings" })).toHaveProperty("disabled", true);
    expect(requests.every(request => request.method === "GET")).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Remove not_a_language" }));
    fireEvent.click(screen.getByRole("button", { name: "Save translation settings" }));
    await screen.findByText("Translation settings saved.");
    expect(requests.find(request => request.method === "PUT")?.body?.language_tags).toEqual(["fr"]);
  });

  it("clears a reviewer language missing from the palette without changing another member's assignment", async () => {
    members = [{ id: "m", user_id: "u", user: { name: "Ada" } }, { id: "other", user_id: "other-user", user: { name: "Bea" } }];
    reviewers = [{ member_id: "m", user_id: "u", languages: ["sw"] }, { member_id: "other", user_id: "other-user", languages: ["fr"] }];
    mount(); await screen.findByRole("button", { name: "Remove sw from Ada" });
    const ada = within(screen.getByText("Ada").parentElement!);
    expect(ada.getByText("sw (sw)")).toBeDefined();
    fireEvent.click(ada.getByRole("button", { name: "Remove sw from Ada" }));
    fireEvent.click(ada.getByRole("button", { name: "Save reviewer" }));
    await ada.findByText("Reviewer languages saved.");
    expect(requests.find(request => request.path.endsWith("/reviewers/m"))?.body).toEqual({ languages: [] });
    expect(screen.getByRole("button", { name: "Remove fr from Bea" })).toBeDefined();
    expect(ada.queryByRole("button", { name: "Remove sw from Ada" })).toBeNull();
    expect(ada.getByRole("button", { name: "Save reviewer" })).toHaveProperty("disabled", true);
  });

  it("prevents duplicate reviewer saves while the real HTTP mutation is pending", async () => {
    members = [{ id: "m", user_id: "u", user: { name: "Ada" } }];
    reviewers = [{ member_id: "m", user_id: "u", languages: ["fr"] }];
    let release!: () => void;
    saveGate = new Promise<void>(resolve => { release = resolve; });
    mount(); await screen.findByRole("button", { name: "Remove fr from Ada" });
    const ada = within(screen.getByText("Ada").parentElement!);
    fireEvent.click(ada.getByRole("button", { name: "Remove fr from Ada" }));
    fireEvent.click(ada.getByRole("button", { name: "Save reviewer" }));
    const saving = await ada.findByRole("button", { name: "Saving…" });
    expect(saving).toHaveProperty("disabled", true);
    fireEvent.click(saving);
    expect(requests.filter(request => request.method === "PUT")).toHaveLength(1);
    expect(reviewers[0].languages).toEqual(["fr"]);
    await act(async () => { release(); });
    await ada.findByText("Reviewer languages saved.");
    expect(reviewers[0].languages).toEqual([]);
    expect(ada.getByRole("button", { name: "Save reviewer" })).toHaveProperty("disabled", true);
    expect(requests.filter(request => request.path.endsWith("/reviewers") && request.method === "GET")).toHaveLength(2);
  });

  it("keeps management controls absent for read-only callers", async () => {
    const { container } = mount(false); await waitFor(() => expect(requests.length).toBe(2)); expect(container.innerHTML).toBe("");
  });
});

it("preserves unsaved settings through a real background query refresh", async () => {
  mount(); await screen.findByLabelText("Primary model");
  fireEvent.change(screen.getByLabelText("Primary model"), { target: { value: "unsaved-model" } });
  config = { ...config, primary_model: "remote-model" };
  await act(async () => { await clients[0].invalidateQueries(); await new Promise(resolve => setTimeout(resolve, 20)); });
  expect((screen.getByLabelText("Primary model") as HTMLInputElement).value).toBe("unsaved-model");
  fireEvent.click(screen.getByRole("button", { name: "Save translation settings" }));
  await screen.findByText("Translation settings saved.");
  expect(config.primary_model).toBe("unsaved-model");
});

it("preserves unsaved reviewer languages through a background refresh", async () => {
  members = [{ id: "m", user_id: "u", user: { name: "Ada" } }];
  reviewers = [{ member_id: "m", user_id: "u", languages: ["fr"] }];
  mount(); await screen.findByRole("button", { name: "Remove fr from Ada" });
  fireEvent.click(screen.getByRole("button", { name: "Remove fr from Ada" }));
  reviewers = [{ member_id: "m", user_id: "u", languages: ["es"] }];
  await act(async () => { await clients[0].invalidateQueries(); await new Promise(resolve => setTimeout(resolve, 20)); });
  expect(screen.queryByRole("button", { name: "Remove es from Ada" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Save reviewer" }));
  await screen.findByText("Reviewer languages saved.");
  expect(reviewers[0].languages).toEqual([]);
});
