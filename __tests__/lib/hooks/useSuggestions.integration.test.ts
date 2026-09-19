import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook } from "@testing-library/react";
import { useSuggestions } from "@/lib/hooks/useSuggestions";
import { useSuggestionStore, storeKey } from "@/lib/stores/suggestionStore";
import { generateTurtleSnippet } from "@/lib/ontology/turtleSnippetGenerator";
import { parseBlockTriples } from "@/lib/ontology/turtleBlockParser";
import { LLM_STATUS_INVALIDATION_EVENT } from "@/lib/api/llm";
import type { GeneratedSuggestion } from "@/lib/api/generation";

const scope = { projectId: "suggestion-project", branch: "feature/suggestions" };
const entityIri = "https://example.test/Parent";
const options = { ...scope, entityIri, suggestionType: "children" as const, canUseLLM: true, accessToken: "fixture-token" };
const suggestion = (overrides: Partial<GeneratedSuggestion> = {}): GeneratedSuggestion => ({
  iri: "https://example.test/Child", label: "Child", suggestion_type: "children", provenance: "llm-proposed", validation_errors: [], duplicate_verdict: "pass", duplicate_candidates: [], ...overrides,
});
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status });
beforeEach(() => useSuggestionStore.getState().clearAllSuggestions());
afterEach(() => { cleanup(); useSuggestionStore.getState().clearAllSuggestions(); vi.unstubAllGlobals(); });

describe("suggestion request and acceptance integration", () => {
  it("requests through the API, edits persisted suggestion state and accepts real Turtle output", async () => {
    const fetch = vi.fn().mockResolvedValue(json({ suggestions: [suggestion()], input_tokens: 1, output_tokens: 1 }));
    vi.stubGlobal("fetch", fetch);
    let source = "@prefix owl: <http://www.w3.org/2002/07/owl#> .\n@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .\n";
    const { result } = renderHook(() => useSuggestions({ ...options, byoKey: "synthetic-byo", batchSize: 2,
      onAccepted: async (item, edited) => { source += generateTurtleSnippet({ iri: item.iri, label: edited ?? item.label, parentIri: entityIri, entityType: "class" }); },
    }));
    await act(async () => { await result.current.request(); });
    expect(result.current.items).toHaveLength(1);
    const [url, init] = fetch.mock.calls[0];
    expect(new URL(url).pathname).toBe("/api/v1/projects/suggestion-project/llm/generate-suggestions");
    expect(init.headers.get("Authorization")).toBe("Bearer fixture-token");
    expect(init.headers.get("X-BYO-API-Key")).toBe("synthetic-byo");
    expect(JSON.parse(init.body)).toEqual({ class_iri: entityIri, branch: scope.branch, suggestion_type: "children", batch_size: 2 });
    act(() => result.current.edit(0, "Edited child"));
    expect(result.current.items[0].suggestion.provenance).toBe("user-edited-from-llm");
    await act(async () => { await result.current.accept(0); });
    expect(result.current.items[0].status).toBe("accepted");
    expect(useSuggestionStore.getState().getPendingCount(scope)).toBe(0);
    expect(parseBlockTriples(source, suggestion().iri)).toContainEqual({ predicate: "http://www.w3.org/2000/01/rdf-schema#label", object: { type: "literal", value: "Edited child", lang: "en" } });
  });

  it("integrates seeded suggestions, duplicate decisions and rejection without mocks", () => {
    const sameIri = "https://example.test/Candidate";
    const first = { iri: sameIri, label: "Candidate", score: 0.99, branch: "main" };
    const second = { ...first, score: 0.9, branch: "other" };
    useSuggestionStore.getState().setSuggestions(scope, entityIri, "children", [suggestion({ duplicate_verdict: "block", duplicate_candidates: [first, second] })]);
    const { result } = renderHook(() => useSuggestions(options));
    act(() => result.current.markDistinct(0, first));
    expect(result.current.items[0].suggestion.duplicate_candidates).toEqual([second]);
    expect(result.current.items[0].suggestion.duplicate_verdict).toBe("warn");
    act(() => result.current.markDistinct(0, second));
    expect(result.current.items[0].suggestion.duplicate_verdict).toBe("pass");
    act(() => result.current.reject(0));
    expect(result.current.items[0].status).toBe("rejected");
    expect(useSuggestionStore.getState().getPendingCount(scope)).toBe(0);
  });

  it.each([
    [400, "No generation model"], [401, "Could not generate suggestions."], [402, "budget has been exhausted"], [403, "role does not allow"],
    [429, "request limit"], [500, "unexpected error"], [502, "provider is unavailable"], [503, "pricing is unavailable"],
  ])("surfaces HTTP %s and invalidates budgets only for quota errors", async (status, message) => {
    const fetch = vi.fn().mockResolvedValue(json({ detail: "backend detail" }, status));
    vi.stubGlobal("fetch", fetch);
    const events: unknown[] = [];
    const listener = (event: Event) => events.push((event as CustomEvent).detail);
    window.addEventListener(LLM_STATUS_INVALIDATION_EVENT, listener);
    try {
      const { result } = renderHook(() => useSuggestions(options));
      await act(async () => { await result.current.request(); });
      expect(result.current.error).toContain(message);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.items).toEqual([]);
      expect(fetch).toHaveBeenCalledTimes(1);
      expect(events).toEqual(status === 402 || status === 429 ? [{ projectId: scope.projectId }] : []);
    } finally { window.removeEventListener(LLM_STATUS_INVALIDATION_EVENT, listener); }
  });

  it("does not replace suggestions after an aborted entity request resolves late", async () => {
    let resolve!: (value: Response) => void;
    let signal: AbortSignal | undefined;
    vi.stubGlobal("fetch", (_url: string, init: RequestInit) => { signal = init.signal!; return new Promise<Response>((done) => { resolve = done; }); });
    const { result, rerender } = renderHook(({ entity }) => useSuggestions({ ...options, entityIri: entity }), { initialProps: { entity: entityIri } });
    let pending!: Promise<void>;
    act(() => { pending = result.current.request(); });
    rerender({ entity: "https://example.test/Next" });
    expect(signal?.aborted).toBe(true);
    await act(async () => { resolve(json({ suggestions: [suggestion()] })); await pending; });
    expect(result.current.items).toEqual([]);
    expect(useSuggestionStore.getState().suggestions[storeKey(scope, entityIri, "children")]).toBeUndefined();
  });

  it("retains a pending suggestion when real serialization rejects its unsafe IRI", async () => {
    useSuggestionStore.getState().setSuggestions(scope, entityIri, "children", [suggestion({ iri: "https://example.test/bad child" })]);
    const { result } = renderHook(() => useSuggestions({ ...options, onAccepted: (item) => { generateTurtleSnippet({ iri: item.iri, label: item.label, entityType: "class" }); } }));
    await act(async () => { await result.current.accept(0); });
    expect(result.current.items[0].status).toBe("pending");
    expect(result.current.error).toContain("Invalid IRI");
    expect(result.current.acceptingIndices.size).toBe(0);
  });

  it("rejects acceptance after the list changes while persistence is pending", async () => {
    useSuggestionStore.getState().setSuggestions(scope, entityIri, "children", [suggestion()]);
    let finish!: () => void;
    const { result } = renderHook(() => useSuggestions({ ...options, onAccepted: () => new Promise<void>((resolve) => { finish = resolve; }) }));
    let pending!: Promise<void>;
    act(() => { pending = result.current.accept(0); });
    expect(result.current.acceptingIndices.has(0)).toBe(true);
    act(() => useSuggestionStore.getState().setSuggestions(scope, entityIri, "children", [suggestion({ label: "Replacement" })]));
    await act(async () => { finish(); await pending; });
    expect(result.current.error).toContain("suggestion list changed");
    expect(result.current.items[0]).toMatchObject({ status: "pending", suggestion: { label: "Replacement" } });
  });

  it("makes empty editor actions safe without creating suggestion entries", async () => {
    const { result } = renderHook(() => useSuggestions({ ...options, entityIri: null }));
    await act(async () => { await result.current.request(); await result.current.accept(0); });
    act(() => { result.current.reject(0); result.current.edit(0, "ignored"); result.current.markDistinct(0, { iri: "unused", label: "Unused", score: 1 }); });
    expect(result.current.items).toEqual([]);
    expect(useSuggestionStore.getState().suggestions).toEqual({});
  });

  it("ignores a cancelled transport rejection while a replacement generation completes", async () => {
    let calls = 0;
    vi.stubGlobal("fetch", (_url: string, init: RequestInit) => {
      calls++;
      if (calls === 2) return Promise.resolve(json({ suggestions: [suggestion({ label: "Replacement" })] }));
      return new Promise<Response>((_resolve, reject) => {
        init.signal!.addEventListener("abort", () => reject(new DOMException("Cancelled", "AbortError")), { once: true });
      });
    });
    const { result } = renderHook(() => useSuggestions(options));
    let first!: Promise<void>;
    act(() => { first = result.current.request(); });
    expect(result.current.isLoading).toBe(true);
    await act(async () => { await result.current.request(); await first; });
    expect(calls).toBe(2);
    expect(result.current.error).toBeNull();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.items[0]).toMatchObject({ status: "pending", suggestion: { label: "Replacement" } });
  });

  it.each([
    [new TypeError("Network unavailable"), "Network unavailable"],
    ["transport failure", "Could not generate suggestions."],
  ])("recovers from a transport rejection %s without losing the pending draft", async (failure, message) => {
    useSuggestionStore.getState().setSuggestions(scope, entityIri, "children", [suggestion()]);
    const fetch = vi.fn().mockRejectedValueOnce(failure).mockResolvedValueOnce(json({ suggestions: [] }));
    vi.stubGlobal("fetch", fetch);
    const { result } = renderHook(() => useSuggestions(options));
    await act(async () => { await result.current.request(); });
    expect(result.current.error).toBe(message);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.items[0].suggestion.label).toBe("Child");
    await act(async () => { await result.current.request(); });
    expect(result.current.error).toBeNull();
    expect(result.current.items).toEqual([]);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("serializes one accepted child despite duplicate acceptance and generation attempts", async () => {
    useSuggestionStore.getState().setSuggestions(scope, entityIri, "children", [suggestion()]);
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    let finish!: () => void;
    const ready = new Promise<void>((resolve) => { finish = resolve; });
    let writes = 0;
    let source = "@prefix owl: <http://www.w3.org/2002/07/owl#> .\n@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .\n";
    const { result } = renderHook(() => useSuggestions({ ...options, onAccepted: async (item) => {
      writes++;
      await ready;
      source += generateTurtleSnippet({ iri: item.iri, label: item.label, entityType: "class" });
    } }));
    let acceptance!: Promise<void>;
    act(() => { acceptance = result.current.accept(0); });
    await act(async () => { await result.current.accept(0); await result.current.request(); });
    expect(writes).toBe(1);
    expect(fetch).not.toHaveBeenCalled();
    expect(result.current.items[0].status).toBe("pending");
    await act(async () => { finish(); await acceptance; });
    expect(result.current.items[0].status).toBe("accepted");
    expect(result.current.acceptingIndices.size).toBe(0);
    await act(async () => { await result.current.accept(0); await result.current.accept(99); });
    expect(writes).toBe(1);
    expect(parseBlockTriples(source, suggestion().iri)).toContainEqual({ predicate: "http://www.w3.org/2000/01/rdf-schema#label", object: { type: "literal", value: "Child", lang: "en" } });
  });
});
