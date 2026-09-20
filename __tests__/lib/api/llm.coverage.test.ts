import { afterEach, describe, expect, it, vi } from "vitest";
import { llmApi } from "@/lib/api/llm";
import { ApiError } from "@/lib/api/client";
import { jsonResponse } from "../../fixtures/llm-hook-harness";

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });
describe("llmApi real HTTP serialization", () => {
  it.each([
    ["config", llmApi.getConfig, { provider: "ollama", api_key_set: false }],
    ["usage", llmApi.getUsage, { total_calls: 0, users: [] }],
    ["status", llmApi.getStatus, { configured: false, daily_remaining: null }],
  ] as const)("reads project %s with bearer authorization and parses server data", async (suffix, call, payload) => {
    const fetch = vi.fn().mockResolvedValue(jsonResponse(payload)); vi.stubGlobal("fetch", fetch);
    await expect(call("fixture-project", "fixture-token")).resolves.toEqual(payload);
    expect(new URL(fetch.mock.calls[0][0]).pathname).toBe(`/api/v1/projects/fixture-project/llm/${suffix}`);
    expect(fetch.mock.calls[0][1].method).toBe("GET");
    expect(fetch.mock.calls[0][1].headers.get("Authorization")).toBe("Bearer fixture-token");
    expect(fetch.mock.calls[0][1].body).toBeUndefined();
  });
  it.each([["providers", llmApi.getProviders], ["known-models", llmApi.getKnownModels]] as const)("requests public %s without authorization", async (suffix, call) => {
    const fetch = vi.fn().mockResolvedValue(jsonResponse([])); vi.stubGlobal("fetch", fetch);
    await expect(call()).resolves.toEqual([]);
    expect(new URL(fetch.mock.calls[0][0]).pathname).toBe(`/api/v1/llm/${suffix}`);
    expect(fetch.mock.calls[0][1].headers.has("Authorization")).toBe(false);
  });
  it("serializes explicit null limits and the write-only credential when updating", async () => {
    const update = { provider: "custom" as const, api_key: "synthetic-key", model: null, base_url: "http://fixture.invalid", monthly_budget_usd: null, daily_cap_usd: 0 };
    const response = { ...update, api_key: undefined, api_key_set: true };
    const fetch = vi.fn().mockResolvedValue(jsonResponse(response)); vi.stubGlobal("fetch", fetch);
    await expect(llmApi.updateConfig("project", update, "token")).resolves.toEqual(response);
    expect(fetch.mock.calls[0][1].method).toBe("PUT");
    expect(fetch.mock.calls[0][1].headers.get("Content-Type")).toBe("application/json");
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual(update);
  });
  it.each([undefined, "", "synthetic-key"])("tests connection with optional BYO header %s and no JSON body", async (key) => {
    const fetch = vi.fn().mockResolvedValue(jsonResponse({ success: true })); vi.stubGlobal("fetch", fetch);
    await expect(llmApi.testConnection("project", "token", key)).resolves.toEqual({ success: true });
    expect(new URL(fetch.mock.calls[0][0]).pathname).toBe("/api/v1/projects/project/llm/test-connection");
    expect(fetch.mock.calls[0][1].method).toBe("POST");
    expect(fetch.mock.calls[0][1].body).toBeUndefined();
    expect(fetch.mock.calls[0][1].headers.get("X-BYO-API-Key")).toBe(key || null);
  });
  it("does not retry a registry 503 through the real request implementation", async () => {
    const fetch = vi.fn().mockResolvedValue(jsonResponse({ detail: "Unavailable" }, 503)); vi.stubGlobal("fetch", fetch);
    await expect(llmApi.getKnownModels()).rejects.toMatchObject({ status: 503 });
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it("retries a transient status outage and parses the recovered response", async () => {
    vi.useFakeTimers();
    const fetch = vi.fn().mockResolvedValueOnce(jsonResponse({}, 503)).mockResolvedValueOnce(jsonResponse({ configured: true })); vi.stubGlobal("fetch", fetch);
    const pending = llmApi.getStatus("project", "token");
    await vi.advanceTimersByTimeAsync(1000);
    await expect(pending).resolves.toEqual({ configured: true });
    expect(fetch).toHaveBeenCalledTimes(2);
  });
  it.each([
    ["config update", () => llmApi.updateConfig("project", { provider: "openai" }, "token")],
    ["connection test", () => llmApi.testConnection("project", "token")],
  ] as const)("does not replay a failed %s write", async (_name, call) => {
    const fetch = vi.fn().mockResolvedValue(jsonResponse({ detail: "Unavailable" }, 503)); vi.stubGlobal("fetch", fetch);
    await expect(call()).rejects.toBeInstanceOf(ApiError);
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it("preserves permission failure status and rejects malformed successful JSON", async () => {
    const fetch = vi.fn().mockResolvedValueOnce(jsonResponse({ detail: "Forbidden" }, 403)).mockResolvedValueOnce(new Response("not JSON")); vi.stubGlobal("fetch", fetch);
    await expect(llmApi.getUsage("project", "token")).rejects.toMatchObject({ status: 403 });
    await expect(llmApi.getConfig("project", "token")).rejects.toBeInstanceOf(SyntaxError);
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});
