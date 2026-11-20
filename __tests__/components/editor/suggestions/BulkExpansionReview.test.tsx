import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BulkExpansionReview } from "@/components/editor/suggestions/BulkExpansionReview";
import type { GeneratedSuggestion } from "@/lib/api/generation";
import { ToastContainer } from "@/components/ui/toast-container";
import { ToastProvider } from "@/lib/context/ToastContext";
import { useSuggestionStore } from "@/lib/stores/suggestionStore";

const scope = { projectId: "project", branch: "main" };
const contract = { label: "Contract", iri: "https://example.org/Contract" };
const policy = { label: "Policy", iri: "https://example.org/Policy" };
const suggestions: GeneratedSuggestion[] = ["Eligible", "Duplicate", "Invalid"].map((label, index) => ({
  iri: `https://example.org/${label}`, label, definition: `Definition of ${label}.`,
  suggestion_type: "children", provenance: "llm-proposed", model: "fixture-model",
  validation_errors: index === 2 ? [{ field: "label", code: "invalid", message: "Invalid label." }] : [],
  duplicate_verdict: index === 1 ? "block" : "pass", duplicate_candidates: [],
}));

describe("BulkExpansionReview", () => {
  beforeEach(() => useSuggestionStore.getState().clearAllSuggestions());

  it("offers Close only once nothing is waiting or generating", () => {
    const dismiss = vi.fn();
    const renderReview = (running: boolean) => (
      <ToastProvider>
        <BulkExpansionReview {...scope} canUseLLM dismiss={dismiss}
          jobs={[{ ...contract, status: running ? "generating" : "done" }]}
          totals={{ done: running ? 0 : 1, failed: 0, waiting: 0, generating: running ? 1 : 0, skipped: 0 }}
          haltReason={null} stop={vi.fn()} retry={vi.fn()} />
      </ToastProvider>
    );
    const { rerender } = render(renderReview(true));
    expect(screen.queryByRole("button", { name: "Close review" })).toBeNull();
    rerender(renderReview(false));
    fireEvent.click(screen.getByRole("button", { name: "Close review" }));
    expect(dismiss).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Pending suggestions stay on each class after you close this review.")).toBeDefined();
  });

  it("focuses the heading on the first result and confirms eligible accepts only in the opened group", async () => {
    const onAddSuggestedChild = vi.fn().mockResolvedValue(undefined);
    const renderReview = (firstDone: boolean) => (
      <ToastProvider>
        <BulkExpansionReview {...scope} canUseLLM isSuggestionMode onAddSuggestedChild={onAddSuggestedChild}
          jobs={[{ ...contract, status: firstDone ? "done" : "generating" }, { ...policy, status: firstDone ? "done" : "waiting" }]}
          totals={{ done: firstDone ? 2 : 0, failed: 0, waiting: firstDone ? 0 : 1, generating: firstDone ? 0 : 1, skipped: 0 }}
          haltReason={null} stop={vi.fn()} retry={vi.fn()} />
        <ToastContainer />
      </ToastProvider>
    );
    const { rerender } = render(renderReview(false));
    const region = within(screen.getByRole("region", { name: "Bulk expansion review" }));
    const heading = region.getByRole("heading");
    expect(document.activeElement).not.toBe(heading);
    act(() => {
      useSuggestionStore.getState().setSuggestions(scope, contract.iri, "children", suggestions);
      useSuggestionStore.getState().setSuggestions(scope, policy.iri, "children", [suggestions[0]]);
      rerender(renderReview(true));
    });
    await waitFor(() => expect(document.activeElement).toBe(heading));
    expect(region.getByText("2 of 2 classes done, 0 failed")).toBeDefined();
    expect(region.queryByRole("button", { name: /Accept all/i })).toBeNull();

    const group = region.getByRole("button", { name: /Contract.*Done/ });
    expect(group.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(group);
    expect(group.getAttribute("aria-expanded")).toBe("true");
    expect(within(group.closest("li")!).getByText("Definition of Eligible.")).toBeDefined();
    expect(region.getAllByRole("button", { name: /Accept all/i })).toHaveLength(1);
    fireEvent.click(region.getByRole("button", { name: "Accept all eligible (1)" }));
    const dialog = within(screen.getByRole("dialog", { name: "Accept all eligible suggestions" }));
    expect(dialog.getByText(/1 class under Contract/)).toBeDefined();
    expect(onAddSuggestedChild).not.toHaveBeenCalled();
    await act(async () => fireEvent.click(dialog.getByRole("button", { name: "Accept 1 class" })));
    expect(onAddSuggestedChild).toHaveBeenCalledExactlyOnceWith(suggestions[0].iri, "Eligible", contract.iri, {
      model: "fixture-model", definition: "Definition of Eligible.",
    });
    expect(screen.getByText(/1 accepted, 2 skipped.*current draft.*discards/)).toBeDefined();
  });
});
