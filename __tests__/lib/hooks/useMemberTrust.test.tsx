import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { memberTrustQueryKeys, useMemberTrust } from "@/lib/hooks/useMemberTrust";
import { jsonResponse, llmHookHarness } from "../../fixtures/llm-hook-harness";

const member = { user_id: "fixture-member", role: "editor", tier: "trusted", is_trusted: true, trust_override: "granted", accepted_count: 7 };
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
describe("useMemberTrust real query and API chain", () => {
  it('does not expose the previous viewer roster when identity or permission changes', async () => {
    const fetch = vi.fn().mockResolvedValueOnce(jsonResponse([member])).mockResolvedValueOnce(jsonResponse([], 200));
    vi.stubGlobal('fetch', fetch);
    const { wrapper } = llmHookHarness();
    const { result, rerender } = renderHook(({ viewer, token, enabled }) => useMemberTrust('project', token, enabled, viewer), {
      wrapper, initialProps: { viewer: 'first-admin', token: 'first-token', enabled: true },
    });
    await waitFor(() => expect(result.current.data).toEqual([member]));
    rerender({ viewer: 'second-admin', token: 'second-token', enabled: true });
    expect(result.current.data).toBeUndefined();
    await waitFor(() => expect(result.current.data).toEqual([]));
    rerender({ viewer: 'first-admin', token: 'first-token', enabled: false });
    expect(result.current.data).toBeUndefined();
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("loads member grants through the authenticated request and refreshes an empty roster", async () => {
    const fetch = vi.fn().mockResolvedValueOnce(jsonResponse([member])).mockResolvedValueOnce(jsonResponse([]));
    vi.stubGlobal("fetch", fetch);
    const { wrapper, client } = llmHookHarness();
    const { result } = renderHook(() => useMemberTrust("project", "token", true, "viewer"), { wrapper });
    await waitFor(() => expect(result.current.data).toEqual([member]));
    expect(new URL(fetch.mock.calls[0][0]).pathname).toBe("/api/v1/projects/project/trust/members");
    expect(fetch.mock.calls[0][1].headers.get("Authorization")).toBe("Bearer token");
    await act(async () => { await result.current.refetch(); });
    await waitFor(() => expect(result.current.data).toEqual([]));
    expect(client.getQueryData(memberTrustQueryKeys.list("project", "viewer"))).toEqual([]);
    client.clear();
  });
  it.each([["", "token", true], ["project", undefined, true], ["project", "token", false]] as const)("gates project=%s token=%s enabled=%s", (project, token, enabled) => {
    const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
    const { wrapper, client } = llmHookHarness();
    const { result } = renderHook(() => useMemberTrust(project, token, enabled, "viewer"), { wrapper });
    expect(result.current.fetchStatus).toBe("idle");
    expect(result.current.data).toBeUndefined(); expect(fetch).not.toHaveBeenCalled(); client.clear();
  });
  it("begins the previously disabled query after permission becomes available", async () => {
    const fetch = vi.fn().mockResolvedValue(jsonResponse([member])); vi.stubGlobal("fetch", fetch);
    const { wrapper, client } = llmHookHarness();
    const { result, rerender } = renderHook(({ enabled }) => useMemberTrust("project", "token", enabled, "viewer"), { wrapper, initialProps: { enabled: false } });
    expect(fetch).not.toHaveBeenCalled(); rerender({ enabled: true });
    await waitFor(() => expect(result.current.data).toEqual([member])); client.clear();
  });
  it("preserves the server permission error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ detail: "Administrator required" }, 403)));
    const { wrapper, client } = llmHookHarness();
    const { result } = renderHook(() => useMemberTrust("project", "token", true, "viewer"), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toMatchObject({ status: 403 });
    expect(result.current.data).toBeUndefined(); client.clear();
  });
  it("uses fresh seeded project cache and isolates another project", () => {
    const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
    const { wrapper, client } = llmHookHarness();
    client.setQueryData(memberTrustQueryKeys.list("one", "viewer"), [member]);
    client.setQueryData(memberTrustQueryKeys.list("two", "viewer"), []);
    const { result, rerender } = renderHook(({ project }) => useMemberTrust(project, "token", true, "viewer"), { wrapper, initialProps: { project: "one" } });
    expect(result.current.data).toEqual([member]); rerender({ project: "two" });
    expect(result.current.data).toEqual([]); expect(fetch).not.toHaveBeenCalled(); client.clear();
  });
});
