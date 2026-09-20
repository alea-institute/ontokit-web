import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useAutoSuggestNavigation } from "@/lib/hooks/useAutoSuggestNavigation";

beforeEach(() => vi.useFakeTimers());
afterEach(() => { cleanup(); vi.useRealTimers(); });

it("debounces to the latest selection and clears an already ready suggestion on navigation", () => {
  const { result, rerender } = renderHook(({ iri }) => useAutoSuggestNavigation(iri, true, "main"), { initialProps: { iri: "first" } });
  act(() => { result.current.schedule("second"); rerender({ iri: "second" }); });
  act(() => vi.advanceTimersByTime(799));
  expect(result.current.shouldSuggest).toBe(false);
  act(() => { result.current.schedule("third"); rerender({ iri: "third" }); });
  act(() => vi.advanceTimersByTime(800));
  expect(result.current.shouldSuggest).toBe(true);
  rerender({ iri: "fourth" });
  expect(result.current.shouldSuggest).toBe(false);
});

it.each(["disable", "branch", "unmount"])("cancels pending navigation when %s changes", change => {
  const { result, rerender, unmount } = renderHook(({ enabled, scope }) => useAutoSuggestNavigation("second", enabled, scope), { initialProps: { enabled: true, scope: "main" } });
  act(() => result.current.schedule("second"));
  expect(vi.getTimerCount()).toBe(1);
  if (change === "unmount") unmount();
  else rerender({ enabled: change !== "disable", scope: change === "branch" ? "feature" : "main" });
  expect(vi.getTimerCount()).toBe(0);
  act(() => vi.advanceTimersByTime(800));
  expect(result.current.shouldSuggest).toBe(false);
});
