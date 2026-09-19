import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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
let reviewers: { member_id: string; user_id: string; languages: string[] }[];
let members: { id: string; user_id: string; user?: { name?: string; email?: string } }[];
let requests: { path: string; method: string; body?: Record<string, unknown>; authorization: string | null }[];
const clients: ReturnType<typeof llmHookHarness>["client"][] = [];
function mount(canManage = true, accessToken: string | undefined = "test-token") {
  const { client, wrapper } = llmHookHarness(); clients.push(client);
  return render(<TranslationSettingsSection projectId="p" accessToken={accessToken} canManage={canManage} />, { wrapper });
}
beforeEach(() => {
  config = { ...initial }; failPath = undefined; failSave = false; members = []; reviewers = []; requests = [];
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", { configurable: true, value: vi.fn() });
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = new URL(String(input)).pathname; const method = init?.method ?? "GET";
    const body = init?.body ? JSON.parse(String(init.body)) as Record<string, unknown> : undefined;
    requests.push({ path, method, body, authorization: new Headers(init?.headers).get("Authorization") });
    if (path === failPath || (method === "PUT" && failSave)) return jsonResponse({ detail: "Settings rejected" }, 422);
    if (path.endsWith("/palette")) return jsonResponse([{ tag: "fr", english_name: "French", native_name: "Français" }, { tag: "es", english_name: "Spanish", native_name: "Español" }]);
    if (path.endsWith("/config")) {
      if (body) {
        const { verifier_api_key, ...editable } = body;
        config = { ...config, ...editable, verifier_api_key_set: !!verifier_api_key };
      }
      return jsonResponse(config);
    }
    if (path.endsWith("/members")) return jsonResponse({ items: members, total: members.length });
    if (path.endsWith("/reviewers")) return jsonResponse(reviewers);
    if (path.includes("/reviewers/")) {
      const reviewer = { member_id: path.split("/").at(-1)!, user_id: "u", languages: body!.languages as string[] };
      reviewers = [reviewer]; return jsonResponse(reviewer);
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
  it("keeps management controls absent for read-only callers", async () => {
    const { container } = mount(false); await waitFor(() => expect(requests.length).toBe(2)); expect(container.innerHTML).toBe("");
  });
});
