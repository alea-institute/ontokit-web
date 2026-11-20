import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api/client";
import { generationApi, type GenerateSuggestionsResponse } from "@/lib/api/generation";
import { useBulkExpansion } from "@/lib/hooks/useBulkExpansion";
import { useSuggestionStore, storeKey } from "@/lib/stores/suggestionStore";

vi.mock("@/lib/api/generation", () => ({ generationApi: { generateSuggestions: vi.fn() } }));
const generate = vi.mocked(generationApi.generateSuggestions);
const scope = { projectId: "project", branch: "main" };
const targets = Array.from({ length: 12 }, (_, i) => ({ iri: `https://example.org/Class${i + 1}`, label: `Class ${i + 1}` }));
const response: GenerateSuggestionsResponse = { suggestions: [], input_tokens: 40, output_tokens: 10 };

function pauseRequest() {
  let finish!: (value: GenerateSuggestionsResponse) => void;
  generate.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
  return () => finish(response);
}

function mount() {
  const announce = vi.fn();
  const hook = renderHook(
    ({ branch }) => useBulkExpansion({ ...scope, branch, canUseLLM: true, accessToken: "fixture", announce }),
    { initialProps: { branch: scope.branch } },
  );
  return { ...hook, announce };
}

describe("useBulkExpansion", () => {
  beforeEach(() => {
    generate.mockReset().mockResolvedValue(response);
    useSuggestionStore.getState().clearAllSuggestions();
  });

  it("runs at most ten classes one at a time, forwards batch size, and announces each settlement once", async () => {
    const finishFirst = pauseRequest();
    const { result, announce } = mount();
    let run!: Promise<void>;
    act(() => { run = result.current.start(targets, 3); });
    expect(generate).toHaveBeenCalledTimes(1);
    expect(result.current.jobs.slice(0, 2).map((job) => job.status)).toEqual(["generating", "waiting"]);
    expect(announce).not.toHaveBeenCalled();
    await act(async () => { finishFirst(); await run; });
    expect(generate.mock.calls.map(([, request]) => request)).toEqual(targets.slice(0, 10).map(({ iri }) => ({
      class_iri: iri, branch: "main", suggestion_type: "children", batch_size: 3,
    })));
    expect(result.current.totals.done).toBe(10);
    expect(announce).toHaveBeenCalledTimes(10);
    expect(announce).toHaveBeenLastCalledWith("Class 10. 10 of 10 classes done, 0 failed");
  });

  it.each([
    [429, { message: "Daily allowance reached. Try tomorrow." }, "Daily allowance reached. Try tomorrow."],
    [402, "Monthly project budget reached.", "Monthly project budget reached."],
  ])("halts at a %s refusal, keeps finished groups and reports the reason without retrying", async (status, detail, reason) => {
    generate.mockResolvedValueOnce(response).mockResolvedValueOnce(response)
      .mockRejectedValueOnce(new ApiError(status, "Refused", JSON.stringify({ detail })));
    const { result, announce } = mount();
    await act(async () => { await result.current.start(targets.slice(0, 5), 10); });
    expect(result.current.jobs.map((job) => job.status)).toEqual(["done", "done", "failed", "skipped", "skipped"]);
    expect(result.current.haltReason).toBe(reason);
    expect(generate).toHaveBeenCalledTimes(3);
    expect(announce).toHaveBeenCalledTimes(3);
    expect(announce.mock.lastCall?.[0]).toContain(reason);
    for (const { iri } of targets.slice(0, 2)) {
      expect(useSuggestionStore.getState().suggestions[storeKey(scope, iri, "children")]).toEqual([]);
    }
  });

  it("continues after a role error and only retries when asked", async () => {
    generate.mockRejectedValueOnce(new ApiError(403, "Forbidden", '{"detail":"Forbidden"}'));
    const { result, announce } = mount();
    await act(async () => { await result.current.start(targets.slice(0, 2), 5); });
    expect(result.current.jobs.map((job) => job.status)).toEqual(["failed", "done"]);
    expect(result.current.jobs[0].error).toBe("Your project role does not allow AI suggestions.");
    expect(generate).toHaveBeenCalledTimes(2);
    await act(async () => { await result.current.retry(targets[0].iri); });
    expect(generate).toHaveBeenCalledTimes(3);
    expect(generate.mock.calls[2][1]).toEqual(generate.mock.calls[0][1]);
    expect(result.current.jobs.map((job) => job.status)).toEqual(["done", "done"]);
    expect(announce).toHaveBeenCalledTimes(3);
  });

  it("stops waiting classes and keeps both completed and in-flight results", async () => {
    generate.mockResolvedValueOnce(response);
    const finishSecond = pauseRequest();
    const { result } = mount();
    let run!: Promise<void>;
    await act(async () => { run = result.current.start(targets.slice(0, 4), 5); });
    act(() => result.current.stop());
    expect(result.current.jobs.map((job) => job.status)).toEqual(["done", "generating", "skipped", "skipped"]);
    await act(async () => { finishSecond(); await run; });
    expect(generate).toHaveBeenCalledTimes(2);
    expect(result.current.jobs.map((job) => job.status)).toEqual(["done", "done", "skipped", "skipped"]);
  });

  it("closes a finished review, and never one that is still generating", async () => {
    generate.mockResolvedValueOnce(response);
    const finishSecond = pauseRequest();
    const { result } = mount();
    let run!: Promise<void>;
    await act(async () => { run = result.current.start(targets.slice(0, 2), 5); });
    act(() => result.current.dismiss());
    expect(result.current.jobs).toHaveLength(2);
    await act(async () => { finishSecond(); await run; });
    act(() => result.current.dismiss());
    expect(result.current.jobs).toEqual([]);
  });

  it.each(["switching branches", "leaving the page"])("aborts and discards late results when %s", async (action) => {
    const finish = pauseRequest();
    const { result, rerender, unmount, announce } = mount();
    let run!: Promise<void>;
    act(() => { run = result.current.start(targets.slice(0, 2), 5); });
    if (action === "switching branches") {
      rerender({ branch: "another-branch" });
      expect(result.current.jobs).toEqual([]);
    } else {
      unmount();
    }
    expect(generate.mock.calls[0][4]?.aborted).toBe(true);
    await act(async () => { finish(); await run; });
    expect(generate).toHaveBeenCalledTimes(1);
    expect(announce).not.toHaveBeenCalled();
    expect(useSuggestionStore.getState().suggestions).toEqual({});
  });
});
