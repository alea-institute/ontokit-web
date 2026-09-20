import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { LintConfigSection } from "@/components/projects/LintConfigSection";
import type { LintConfigResponse, LintSummary } from "@/lib/api/lint";
import { jsonResponse, llmHookHarness } from "../../fixtures/llm-hook-harness";

let config: LintConfigResponse;
let summary: LintSummary;
let failPath: string | undefined;
let failMutation: boolean;
let emptyRules: boolean;
let requests: { path: string; method: string; body?: unknown; authorization: string | null }[];
const clients: ReturnType<typeof llmHookHarness>["client"][] = [];
function mount(canManage = true, accessToken: string | undefined = "fixture-token") {
  const { client, wrapper } = llmHookHarness(); clients.push(client);
  return { client, ...render(<LintConfigSection projectId="p" accessToken={accessToken} canManage={canManage} />, { wrapper }) };
}
const rule = (rule_id: string, severity: string) => ({ rule_id, name: rule_id, severity, description: `${rule_id} description`, scope: ["class"] });
let ruleCatalog: ReturnType<typeof rule>[];
beforeEach(() => {
  ruleCatalog = [rule("Descriptions", "info"), rule("Labels", "error")];
  config = { project_id: "p", lint_level: 2, enabled_rules: null, effective_rules: ["Labels"], updated_at: null };
  summary = { project_id: "p", last_run: null, error_count: 0, warning_count: 0, info_count: 0, total_issues: 0 };
  failPath = undefined; failMutation = false; emptyRules = false; requests = [];
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = new URL(String(input)).pathname; const method = init?.method ?? "GET";
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    requests.push({ path, method, body, authorization: new Headers(init?.headers).get("Authorization") });
    if (path === failPath || (method !== "GET" && failMutation)) return jsonResponse({ detail: "Lint request rejected" }, 403);
    if (path.endsWith("/rules")) return jsonResponse({ rules: emptyRules ? [] : ruleCatalog });
    if (path.endsWith("/levels")) return jsonResponse({ levels: [{ level: 1, name: "Basic", description: "Basic checks", rule_ids: [] }, { level: 2, name: "Standard", description: "Standard checks", rule_ids: ["Labels"] }] });
    if (path.endsWith("/config")) {
      if (body) config = { ...config, ...body, enabled_rules: body.lint_level === null ? body.enabled_rules : null };
      return jsonResponse(config);
    }
    if (path.endsWith("/status")) return jsonResponse(summary);
    if (path.endsWith("/results")) { summary = { ...summary, last_run: null, total_issues: 0, error_count: 0 }; return jsonResponse({}); }
    if (path.endsWith("/run")) { summary = { ...summary, last_run: { id: "run", project_id: "p", status: "pending", started_at: "2026-09-18T00:00:00Z", completed_at: null, issues_found: null, error_message: null } }; return jsonResponse({ job_id: "run", status: "pending", message: "Queued" }); }
    throw new Error(`Unexpected ${method} ${path}`);
  }));
});
afterEach(() => { cleanup(); clients.splice(0).forEach(client => client.clear()); vi.unstubAllGlobals(); });
async function ready() { await screen.findByRole("switch", { name: "Toggle Labels" }); }

describe("lint configuration HTTP integration", () => {
  it("places unfamiliar server severities after known rules without losing their selectable controls", async () => {
    ruleCatalog = [rule("Experimental", "experimental"), rule("Labels", "error"), rule("Descriptions", "info"), rule("Future", "future")];
    config = { ...config, lint_level: null, enabled_rules: [] };
    mount(); await ready();
    expect(screen.getAllByRole("switch").map(toggle => toggle.getAttribute("aria-label"))).toEqual(["Toggle Labels", "Toggle Descriptions", "Toggle Experimental", "Toggle Future"]);
    expect(screen.getByText("experimental").className).toContain("bg-slate-100");
    fireEvent.click(screen.getByRole("switch", { name: "Toggle Experimental" }));
    fireEvent.click(screen.getByRole("button", { name: "Save Lint Configuration" }));
    await screen.findByText("Lint configuration saved");
    expect(requests.find(request => request.method === "PUT")?.body).toEqual({ lint_level: null, enabled_rules: ["Experimental"] });
  });

  it("treats a null custom rule list as empty and persists the first selected rule", async () => {
    config = { ...config, lint_level: null, enabled_rules: null, effective_rules: [] };
    mount(); await ready();
    await waitFor(() => expect(screen.getByRole("button", { name: /Custom/ }).getAttribute("aria-pressed")).toBe("true"));
    expect(screen.getByText("Rules (0 of 2 enabled)")).toBeDefined();
    expect(screen.getByRole("button", { name: "Save Lint Configuration" })).toHaveProperty("disabled", true);
    fireEvent.click(screen.getByRole("switch", { name: "Toggle Labels" }));
    fireEvent.click(screen.getByRole("button", { name: "Save Lint Configuration" }));
    await screen.findByText("Lint configuration saved");
    expect(requests.find(request => request.method === "PUT")?.body).toEqual({ lint_level: null, enabled_rules: ["Labels"] });
    expect(screen.getByRole("switch", { name: "Toggle Labels" }).getAttribute("aria-checked")).toBe("true");
  });

  it("allows recovery from a saved preset missing from the current level catalog", async () => {
    config = { ...config, lint_level: 3, effective_rules: [] };
    mount(); await ready();
    await waitFor(() => expect(screen.getByText("Rules (0 of 2 enabled)")).toBeDefined());
    expect(screen.queryByRole("button", { name: /Level 3/ })).toBeNull();
    expect(screen.getByRole("button", { name: "Save Lint Configuration" })).toHaveProperty("disabled", true);
    fireEvent.click(screen.getByRole("button", { name: /Level 2/ }));
    expect(screen.getByRole("switch", { name: "Toggle Labels" }).getAttribute("aria-checked")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "Save Lint Configuration" }));
    await screen.findByText("Lint configuration saved");
    expect(requests.find(request => request.method === "PUT")?.body).toEqual({ lint_level: 2 });
  });

  it("preserves unsaved custom rules during a background configuration refresh", async () => {
    const { client } = mount(); await ready();
    fireEvent.click(screen.getByRole("button", { name: /Custom/ }));
    fireEvent.click(screen.getByRole("switch", { name: "Toggle Descriptions" }));
    await waitFor(() => expect((screen.getByRole("button", { name: "Save Lint Configuration" }) as HTMLButtonElement).disabled).toBe(false));
    config = { ...config, lint_level: 1, effective_rules: [] };
    await act(async () => { await client.invalidateQueries({ queryKey: ["lintConfig", "p"] }); });
    expect(client.getQueryData<LintConfigResponse>(["lintConfig", "p"])?.lint_level).toBe(1);
    expect(screen.getByRole("button", { name: /Custom/ }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("switch", { name: "Toggle Labels" }).getAttribute("aria-checked")).toBe("true");
    expect(screen.getByRole("switch", { name: "Toggle Descriptions" }).getAttribute("aria-checked")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "Save Lint Configuration" }));
    await screen.findByText("Lint configuration saved");
    expect(requests.find(r => r.method === "PUT")?.body).toEqual({ lint_level: null, enabled_rules: ["Labels", "Descriptions"] });
  });

  it("adopts a background configuration refresh when there are no local edits", async () => {
    const { client } = mount(); await ready();
    config = { ...config, lint_level: null, enabled_rules: ["Descriptions"], effective_rules: ["Descriptions"] };
    await act(async () => { await client.invalidateQueries({ queryKey: ["lintConfig", "p"] }); });
    await waitFor(() => expect(screen.getByRole("button", { name: /Custom/ }).getAttribute("aria-pressed")).toBe("true"));
    expect(screen.getByRole("switch", { name: "Toggle Labels" }).getAttribute("aria-checked")).toBe("false");
    expect(screen.getByRole("switch", { name: "Toggle Descriptions" }).getAttribute("aria-checked")).toBe("true");
    expect((screen.getByRole("button", { name: "Save Lint Configuration" }) as HTMLButtonElement).disabled).toBe(true);
    expect(requests.every(r => r.method === "GET")).toBe(true);
  });

  it("loads preset rules, edits custom rules and persists the exact mutually exclusive payload", async () => {
    mount(); await ready();
    fireEvent.click(screen.getByRole("button", { name: /Custom/ }));
    fireEvent.click(screen.getByRole("switch", { name: "Toggle Labels" }));
    fireEvent.click(screen.getByRole("switch", { name: "Toggle Descriptions" }));
    fireEvent.click(screen.getByRole("button", { name: "Save Lint Configuration" }));
    await screen.findByText("Lint configuration saved");
    expect(requests.find(r => r.method === "PUT")).toMatchObject({ body: { lint_level: null, enabled_rules: ["Descriptions"] }, authorization: "Bearer fixture-token" });
    expect(screen.getByRole("switch", { name: "Toggle Descriptions" }).getAttribute("aria-checked")).toBe("true");
    await waitFor(() => expect((screen.getByRole("button", { name: "Save Lint Configuration" }) as HTMLButtonElement).disabled).toBe(true));
  });
  it("serializes preset selection without sending custom rules", async () => {
    mount(); await ready(); fireEvent.click(screen.getByRole("button", { name: /Level 1/ }));
    fireEvent.click(screen.getByRole("button", { name: "Save Lint Configuration" })); await screen.findByText("Lint configuration saved");
    expect(requests.find(r => r.method === "PUT")?.body).toEqual({ lint_level: 1 });
  });
  it("enables and disables all rules and recognizes restoration of the saved custom set", async () => {
    config = { ...config, lint_level: null, enabled_rules: [] }; mount(); await ready();
    fireEvent.click(screen.getByRole("button", { name: "Enable all" }));
    expect(screen.getByText("Rules (2 of 2 enabled)")).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "Disable all" }));
    expect(screen.getByText("Rules (0 of 2 enabled)")).toBeDefined();
    expect((screen.getByRole("button", { name: "Save Lint Configuration" }) as HTMLButtonElement).disabled).toBe(true);
  });
  it("preserves a failed edit for a subsequent successful save", async () => {
    failMutation = true; mount(); await ready(); fireEvent.click(screen.getByRole("button", { name: /Level 1/ }));
    fireEvent.click(screen.getByRole("button", { name: "Save Lint Configuration" }));
    await screen.findByText(/Lint request rejected/);
    expect(screen.getByRole("button", { name: /Level 1/ }).getAttribute("aria-pressed")).toBe("true");
    failMutation = false; fireEvent.click(screen.getByRole("button", { name: "Save Lint Configuration" }));
    await screen.findByText("Lint configuration saved"); expect(requests.filter(r => r.method === "PUT")).toHaveLength(2);
  });
  it("clears real results, invalidates cached issues and runs, then starts a new run", async () => {
    summary = { ...summary, total_issues: 1, error_count: 1, last_run: { id: "old", project_id: "p", status: "completed", started_at: "2026-09-18T00:00:00Z", completed_at: "2026-09-18T00:01:00Z", issues_found: 1, error_message: null } };
    const { client } = mount(); client.setQueryData(["lintIssues", "p"], []); client.setQueryData(["lintRuns", "p"], []); await ready();
    fireEvent.click(screen.getByRole("button", { name: "Clear Results" })); await screen.findByText("Lint results cleared");
    expect(client.getQueryState(["lintIssues", "p"])?.isInvalidated).toBe(true);
    expect(client.getQueryState(["lintRuns", "p"])?.isInvalidated).toBe(true);
    fireEvent.click(await screen.findByRole("button", { name: "Run Lint" })); await screen.findByText("Lint run started");
    await waitFor(() => expect((screen.getByRole("button", { name: "Running..." }) as HTMLButtonElement).disabled).toBe(true));
    expect(requests.filter(r => r.method !== "GET").map(r => [r.method, r.path])).toEqual([["DELETE", "/api/v1/projects/p/lint/results"], ["POST", "/api/v1/projects/p/lint/run"]]);
  });
  it("renders empty rule catalogs without fetching an unusable configuration", async () => {
    emptyRules = true; mount(); await screen.findByText("No lint rules available."); expect(requests.some(r => r.path.endsWith("/config"))).toBe(false);
  });
  it("surfaces a failed level catalog through the API client", async () => {
    failPath = "/api/v1/projects/lint/levels"; mount(); await screen.findByText("Failed to load lint levels");
  });
  it("keeps loaded custom rules read-only for members lacking management permission", async () => {
    config = { ...config, lint_level: null, enabled_rules: ["Labels"] }; mount(false); await ready();
    expect((screen.getByRole("switch", { name: "Toggle Labels" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByRole("button", { name: "Save Lint Configuration" })).toBeNull();
    fireEvent.click(screen.getByRole("switch", { name: "Toggle Labels" }));
    expect(screen.getByRole("switch", { name: "Toggle Labels" }).getAttribute("aria-checked")).toBe("true");
    expect(requests.every(r => r.method === "GET")).toBe(true);
  });
  it("does not mutate without an access token even when called from an enabled management view", async () => {
    // The UI may remain mounted while the session is absent; action handlers guard it.
    const { wrapper, client } = llmHookHarness(); clients.push(client);
    render(<LintConfigSection projectId="p" canManage />, { wrapper }); await ready();
    fireEvent.click(screen.getByRole("button", { name: /Level 1/ }));
    fireEvent.click(screen.getByRole("button", { name: "Save Lint Configuration" }));
    fireEvent.click(screen.getByRole("button", { name: "Run Lint" }));
    expect(requests.map(r => r.path).sort()).toEqual(["/api/v1/projects/lint/levels", "/api/v1/projects/lint/rules"]);
  });
});
