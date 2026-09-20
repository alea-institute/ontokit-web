import React, { type ReactNode } from "react";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SessionProvider } from "next-auth/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { usePRPartyCard, usePRPartyQueue, usePRPartySettings, prPartyQueryKeys } from "@/lib/hooks/usePRPartyQueue";
import { ApiError } from "@/lib/api/client";

function response(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
}
function harness(authenticated = true) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: 3 } } });
  function Wrapper({ children }: { children: ReactNode }) {
    return <SessionProvider session={authenticated ? { user: { email: "reviewer@example.test" }, accessToken: "test-session", expires: "2099-01-01" } : null} refetchOnWindowFocus={false}>
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    </SessionProvider>;
  }
  return { client, wrapper: Wrapper };
}
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("PR Party hooks through session, query cache and HTTP client", () => {
  it("loads settings through the authenticated API into the reviewer-scoped cache", async () => {
    const fetcher = vi.fn().mockResolvedValue(response({ merge_default: "manual", ntfy_topic: null }));
    vi.stubGlobal("fetch", fetcher);
    const { wrapper, client } = harness();
    const { result } = renderHook(() => usePRPartySettings(), { wrapper });
    await waitFor(() => expect(result.current.settings?.merge_default).toBe("manual"));
    expect(String(fetcher.mock.calls[0][0])).toContain("/api/v1/pr-party/settings");
    expect(new Headers(fetcher.mock.calls[0][1].headers).get("Authorization")).toBe("Bearer test-session");
    expect(client.getQueryData(prPartyQueryKeys.settings("reviewer@example.test"))).toEqual(result.current.settings);
  });

  it.each(["disabled", "signed-out"] as const)("keeps settings empty and sends no request when %s", (mode) => {
    const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
    const { result } = renderHook(() => usePRPartySettings({ enabled: mode !== "disabled" }), harness(mode !== "signed-out"));
    expect(result.current.settings).toBeNull();
    expect(result.current.isLoading).toBe(false);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it.each(["queue", "settings", "card"] as const)("exposes a real forbidden response from %s without manufacturing data", async (kind) => {
    vi.stubGlobal("fetch", vi.fn().mockImplementation(async () => response({ detail: "Reviewer access required" }, 403)));
    const { result } = renderHook(() => ({ queue: usePRPartyQueue(), settings: usePRPartySettings(), card: usePRPartyCard("missing") }), harness());
    await waitFor(() => expect(result.current[kind].isError).toBe(true));
    expect(result.current[kind].error).toBeInstanceOf(ApiError);
    expect(result.current[kind].error).toMatchObject({ status: 403 });
    expect(result.current.queue.cards).toEqual([]);
    expect(result.current.settings.settings).toBeNull();
    expect(result.current.card.card).toBeNull();
  });

  it("encodes a card identifier and recovers a failed detail read by explicit refetch", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(response({ detail: "Missing" }, 404)).mockResolvedValueOnce(response({ card_id: "org/card #1", brief_what: "Recovered detail" }));
    vi.stubGlobal("fetch", fetcher);
    const { result } = renderHook(() => usePRPartyCard("org/card #1"), harness());
    await waitFor(() => expect(result.current.isError).toBe(true));
    await act(async () => { await result.current.refetch(); });
    await waitFor(() => expect(result.current.card?.brief_what).toBe("Recovered detail"));
    expect(result.current.error).toBeNull();
    expect(String(fetcher.mock.calls[0][0])).toContain("/cards/org%2Fcard%20%231");
  });

  it.each(["question", "note", "rerun", "unpark"] as const)("posts %s once and invalidates only the acting reviewer's cache", async (kind) => {
    const fetcher = vi.fn().mockResolvedValue(response({ posted: true, card_id: "c/1" }));
    vi.stubGlobal("fetch", fetcher);
    const { wrapper, client } = harness();
    const own = "reviewer@example.test";
    for (const identity of [own, "other@example.test"]) {
      client.setQueryData(prPartyQueryKeys.card(identity, "c/1"), { card_id: "c/1" });
      client.setQueryData(prPartyQueryKeys.settings(identity), { merge_default: "manual" });
    }
    const { result } = renderHook(() => usePRPartyQueue({ enabled: false }), { wrapper });
    await act(async () => {
      if (kind === "question") await result.current.askQuestion({ cardId: "c/1", question: "Why?" });
      if (kind === "note") await result.current.addNote({ cardId: "c/1", note: "Needs review" });
      if (kind === "rerun") await result.current.rerunReview({ cardId: "c/1" });
      if (kind === "unpark") await result.current.unparkCard({ cardId: "c/1" });
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
    const [url, init] = fetcher.mock.calls[0];
    expect(String(url)).toContain(`/cards/c%2F1/${{ question: "questions", note: "notes", rerun: "rerun-review", unpark: "unpark" }[kind]}`);
    expect(init.method).toBe("POST");
    if (kind === "question") expect(JSON.parse(init.body)).toEqual({ question: "Why?" });
    if (kind === "note") expect(JSON.parse(init.body)).toEqual({ note: "Needs review" });
    expect(client.getQueryState(prPartyQueryKeys.card(own, "c/1"))?.isInvalidated).toBe(true);
    expect(client.getQueryState(prPartyQueryKeys.settings(own))?.isInvalidated).toBe(true);
    expect(client.getQueryState(prPartyQueryKeys.card("other@example.test", "c/1"))?.isInvalidated).toBe(false);
  });

  it("tracks two concurrent comment operations independently until each response settles", async () => {
    let finishQuestion!: (value: Response) => void;
    let finishNote!: (value: Response) => void;
    vi.stubGlobal("fetch", vi.fn((url: string) => new Promise<Response>((resolve) => {
      if (url.endsWith("/questions")) finishQuestion = resolve;
      else finishNote = resolve;
    })));
    const { result } = renderHook(() => usePRPartyQueue({ enabled: false }), harness());
    let question!: ReturnType<typeof result.current.askQuestion>;
    let note!: ReturnType<typeof result.current.addNote>;
    act(() => {
      question = result.current.askQuestion({ cardId: "concurrent", question: "Why?" });
      note = result.current.addNote({ cardId: "concurrent", note: "Investigating" });
    });
    await waitFor(() => {
      expect(result.current.isAskingQuestion).toBe(true);
      expect(result.current.isAddingNote).toBe(true);
    });
    await act(async () => { finishQuestion(response({ posted: true })); await question; });
    await waitFor(() => expect(result.current.isAskingQuestion).toBe(false));
    expect(result.current.isAddingNote).toBe(true);
    await act(async () => { finishNote(response({ posted: true })); await note; });
    await waitFor(() => expect(result.current.isAddingNote).toBe(false));
  });

  it("does not replay a failed comment even when global mutation retries are enabled", async () => {
    const fetcher = vi.fn().mockResolvedValue(response({ detail: "Upstream unavailable" }, 503));
    vi.stubGlobal("fetch", fetcher);
    const { wrapper, client } = harness();
    const key = prPartyQueryKeys.card("reviewer@example.test", "c1");
    client.setQueryData(key, { card_id: "c1" });
    const { result } = renderHook(() => usePRPartyQueue({ enabled: false }), { wrapper });
    await act(async () => {
      await expect(result.current.askQuestion({ cardId: "c1", question: "Why?" })).rejects.toMatchObject({ status: 503 });
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(client.getQueryState(key)?.isInvalidated).toBe(false);
    expect(result.current.isAskingQuestion).toBe(false);
  });
});
