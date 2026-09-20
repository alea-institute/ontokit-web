import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { useLLMConfig } from "@/lib/hooks/useLLMConfig";
import { jsonResponse, llmHookHarness } from "../../fixtures/llm-hook-harness";

const config = { provider: "openai", model: null, model_tier: "cheap", api_key_set: false, base_url: null, monthly_budget_usd: null, daily_cap_usd: null };
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
function seeded() {
  const harness = llmHookHarness();
  harness.client.setQueryData(["llm-config", "project", "token"], config);
  harness.client.setQueryData(["llm-known-models"], []);
  return harness;
}
describe("useLLMConfig with real query cache and API", () => {
  it("uses fresh cache and fetches the public registry when project config is disabled", async () => {
    const fetch = vi.fn().mockResolvedValue(jsonResponse([])); vi.stubGlobal("fetch", fetch);
    const { wrapper, client } = seeded();
    const { result, rerender } = renderHook(({ project, token }) => useLLMConfig(project, token), { wrapper, initialProps: { project: "project", token: "token" } });
    expect(result.current.config).toEqual(config); expect(fetch).not.toHaveBeenCalled();
    client.removeQueries({ queryKey: ["llm-known-models"] });
    rerender({ project: "", token: "" });
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    expect(new URL(fetch.mock.calls[0][0]).pathname).toBe("/api/v1/llm/known-models");
    expect(result.current.config).toBeUndefined(); client.clear();
  });
  it("updates via PUT then refreshes active config and invalidates project status variants", async () => {
    const updated = { ...config, model: "fixture-model", monthly_budget_usd: 12 };
    const fetch = vi.fn().mockResolvedValueOnce(jsonResponse(updated)).mockResolvedValueOnce(jsonResponse(updated)); vi.stubGlobal("fetch", fetch);
    const { wrapper, client } = seeded();
    client.setQueryData(["llm-status", "project", "token"], { configured: false });
    client.setQueryData(["llm-config", "project", "other-token"], config);
    client.setQueryData(["llm-status", "unrelated", "token"], { configured: false });
    const { result } = renderHook(() => useLLMConfig("project", "token"), { wrapper });
    await act(async () => { await result.current.updateConfig({ provider: "openai", model: "fixture-model", monthly_budget_usd: 12 }); });
    await waitFor(() => expect(result.current.config).toEqual(updated));
    expect(fetch.mock.calls[0][1].method).toBe("PUT");
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ provider: "openai", model: "fixture-model", monthly_budget_usd: 12 });
    expect(client.getQueryState(["llm-status", "project", "token"])?.isInvalidated).toBe(true);
    expect(client.getQueryState(["llm-config", "project", "other-token"])?.isInvalidated).toBe(true);
    expect(client.getQueryState(["llm-status", "unrelated", "token"])?.isInvalidated).toBe(false);
    client.clear();
  });
  it("rejects an unsuccessful update while preserving cached configuration", async () => {
    const fetch = vi.fn().mockResolvedValue(jsonResponse({ detail: "Invalid budget" }, 422)); vi.stubGlobal("fetch", fetch);
    const { wrapper, client } = seeded();
    const { result } = renderHook(() => useLLMConfig("project", "token"), { wrapper });
    await act(async () => { await expect(result.current.updateConfig({ provider: "openai", monthly_budget_usd: -1 })).rejects.toMatchObject({ status: 422 }); });
    await waitFor(() => expect(result.current.updateError).toMatchObject({ status: 422 }));
    expect(result.current.config).toEqual(config);
    expect(fetch).toHaveBeenCalledTimes(1); client.clear();
  });
  it("returns connection diagnostics and forwards an optional BYO credential only to the request", async () => {
    const fetch = vi.fn().mockResolvedValueOnce(jsonResponse({ success: false, error: "Provider unavailable" })).mockResolvedValueOnce(jsonResponse({ success: true })); vi.stubGlobal("fetch", fetch);
    const { wrapper, client } = seeded();
    const { result } = renderHook(() => useLLMConfig("project", "token"), { wrapper });
    await act(async () => { await result.current.testConnection("synthetic-fixture-key"); });
    await waitFor(() => expect(result.current.testResult).toEqual({ success: false, error: "Provider unavailable" }));
    expect(fetch.mock.calls[0][1].headers.get("X-BYO-API-Key")).toBe("synthetic-fixture-key");
    await act(async () => { await result.current.testConnection(undefined); });
    await waitFor(() => expect(result.current.testResult).toEqual({ success: true }));
    expect(fetch.mock.calls[1][1].headers.has("X-BYO-API-Key")).toBe(false);
    expect(client.getQueryData(["llm-config", "project", "token"])).toEqual(config); client.clear();
  });
  it("reports an unconfigured project 404 while still loading known models", async () => {
    const model = { provider: "openai", model_id: "fixture-model", display_name: "Fixture model", tier: "cheap" };
    const fetch = vi.fn((url: string) => Promise.resolve(url.endsWith("known-models") ? jsonResponse([model]) : jsonResponse({ detail: "Unconfigured" }, 404))); vi.stubGlobal("fetch", fetch);
    const { wrapper, client } = llmHookHarness();
    const { result } = renderHook(() => useLLMConfig("project", "token"), { wrapper });
    await waitFor(() => expect(result.current.error).toMatchObject({ status: 404 }));
    expect(result.current.knownModels).toEqual([model]); expect(result.current.config).toBeUndefined();
    expect(fetch).toHaveBeenCalledTimes(2); client.clear();
  });
  it("retains a rejected connection as a rejection without modifying config", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Network offline")));
    const { wrapper, client } = seeded();
    const { result } = renderHook(() => useLLMConfig("project", "token"), { wrapper });
    await act(async () => { await expect(result.current.testConnection(undefined)).rejects.toThrow("Network offline"); });
    expect(result.current.testResult).toBeUndefined(); expect(result.current.config).toEqual(config); client.clear();
  });
  it("exposes pending flags until update and connection requests settle", async () => {
    let resolveUpdate!: (response: Response) => void;
    let resolveConnection!: (response: Response) => void;
    const fetch = vi.fn()
      .mockImplementationOnce(() => new Promise<Response>((resolve) => { resolveUpdate = resolve; }))
      .mockResolvedValueOnce(jsonResponse(config))
      .mockImplementationOnce(() => new Promise<Response>((resolve) => { resolveConnection = resolve; }));
    vi.stubGlobal("fetch", fetch);
    const { wrapper, client } = seeded();
    const { result } = renderHook(() => useLLMConfig("project", "token"), { wrapper });
    let updating!: Promise<unknown>;
    act(() => { updating = result.current.updateConfig({ provider: "openai" }); });
    await waitFor(() => expect(result.current.isUpdating).toBe(true));
    await act(async () => { resolveUpdate(jsonResponse(config)); await updating; });
    await waitFor(() => expect(result.current.isUpdating).toBe(false));
    let testing!: Promise<unknown>;
    act(() => { testing = result.current.testConnection(undefined); });
    await waitFor(() => expect(result.current.isTesting).toBe(true));
    await act(async () => { resolveConnection(jsonResponse({ success: true })); await testing; });
    await waitFor(() => expect(result.current.isTesting).toBe(false));
    expect(result.current.testResult).toEqual({ success: true }); client.clear();
  });

});
