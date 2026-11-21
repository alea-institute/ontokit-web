import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SuggestionBatchReview } from "@/components/editor/suggestions/SuggestionBatchReview";
import type { GeneratedSuggestion } from "@/lib/api/generation";
import { ToastContainer } from "@/components/ui/toast-container";
import { ToastProvider } from "@/lib/context/ToastContext";
import { useSuggestions } from "@/lib/hooks/useSuggestions";
import { useSuggestionStore } from "@/lib/stores/suggestionStore";

const scope = { projectId: "project", branch: "main" };
const entityIri = "https://example.org/Contract";
const title = "Suggested subclasses for Contract";

function mount(count: number, includeBlocked = false, existingKind?: "sibling" | "subclass") {
  const items: GeneratedSuggestion[] = Array.from({ length: count }, (_, index) => ({
    iri: `https://example.org/Class${index}`, label: `Class ${index}`,
    definition: `Definition for class ${index}.`,
    suggestion_type: "children", provenance: "llm-proposed", model: "fixture-model",
    validation_errors: [], duplicate_verdict: "pass", duplicate_candidates: [],
  }));
  if (includeBlocked) {
    items.push({
      ...items[0], iri: "https://example.org/Blocked", label: "Blocked class",
      duplicate_verdict: "block",
      duplicate_candidates: [{ iri: entityIri, label: "Contract", score: 0.99 }],
    });
  }
  useSuggestionStore.getState().setSuggestions(scope, entityIri, "children", items);
  const onAccepted = vi.fn();
  const returnFocus = vi.fn();

  function Harness() {
    const review = useSuggestions({ ...scope, entityIri, suggestionType: "children", canUseLLM: true, onAccepted });
    return (
      <SuggestionBatchReview
        title={title} parentLabel="Contract" review={review} onRequest={vi.fn()}
        requestVersion={1} returnFocus={returnFocus} siblingCount={2} existingKind={existingKind}
      />
    );
  }

  render(<ToastProvider><Harness /><ToastContainer /></ToastProvider>);
  return { onAccepted, returnFocus, region: screen.getByRole("region", { name: title }) };
}

describe("SuggestionBatchReview", () => {
  beforeEach(() => useSuggestionStore.getState().clearAllSuggestions());

  it("shows each generated definition on its suggestion card before acceptance", () => {
    const { region } = mount(2);
    for (const [index, card] of within(region).getAllByRole("listitem").entries()) {
      expect(within(card).getByText(`Class ${index}`)).toBeDefined();
      expect(within(card).getByText(`Definition for class ${index}.`)).toBeDefined();
    }
  });

  it("announces progress and excludes blocked cards from the count and confirmation threshold", async () => {
    const { region, onAccepted, returnFocus } = mount(3, true);
    const heading = within(region).getByRole("heading", { name: title });
    expect(document.activeElement).toBe(heading);
    expect(within(region).getByText("AI-suggested")).toBeDefined();
    expect(within(region).getByText("fixture-model")).toBeDefined();
    const progress = within(region).getByText("3 pending, 0 accepted, 0 rejected, 1 blocked as duplicate");
    expect(progress.getAttribute("aria-live")).toBe("polite");
    fireEvent.click(within(region).getByRole("button", { name: "Accept all (3)" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    await waitFor(() => expect(progress.textContent).toBe("0 pending, 3 accepted, 0 rejected, 1 blocked as duplicate"));
    expect(onAccepted).toHaveBeenCalledTimes(3);
    expect(within(region).getByText("Blocked class")).toBeDefined();
    expect(returnFocus).not.toHaveBeenCalled();
    const blockedCard = within(region).getAllByRole("listitem").find((item) => item.textContent?.includes("Blocked class"))!;
    const reject = within(blockedCard).getByRole<HTMLButtonElement>("button", { name: "Reject suggestion" });
    await waitFor(() => expect(reject.disabled).toBe(false));
    fireEvent.click(reject);
    await waitFor(() => expect(returnFocus).toHaveBeenCalledTimes(1));
    expect(screen.getByText("3 accepted, 1 skipped. Each accepted class is saved as it is accepted.")).toBeDefined();
  });

  it("restores rejected suggestions for another look", async () => {
    const { region } = mount(2);
    expect(within(region).queryByRole("button", { name: /Restore rejected/ })).toBeNull();
    fireEvent.click(within(region).getAllByRole("button", { name: "Reject suggestion" })[0]);
    await waitFor(() => expect(within(region).getByText(/1 pending, 0 accepted, 1 rejected/)).toBeDefined());
    expect(within(region).queryByText("Class 0")).toBeNull();
    fireEvent.click(within(region).getByRole("button", { name: "Restore rejected (1)" }));
    await waitFor(() => expect(within(region).getByText(/2 pending, 0 accepted, 0 rejected/)).toBeDefined());
    expect(within(region).getByText("Class 0")).toBeDefined();
  });

  it("names existing subclasses in the grounding of a subclass batch", () => {
    const { region } = mount(1, false, "subclass");
    fireEvent.click(within(region).getByRole("button", { name: "Grounding" }));
    expect(within(region).getByText("Based on: label, definition, parents, and 2 existing subclasses")).toBeDefined();
  });

  it("confirms four eligible acceptances and names their parent", async () => {
    const { region, onAccepted } = mount(4);
    fireEvent.click(within(region).getByRole("button", { name: "Accept all (4)" }));
    const dialog = screen.getByRole("dialog", { name: "Accept all suggestions" });
    expect(within(dialog).getByText(/4 classes under Contract/)).toBeDefined();
    expect(onAccepted).not.toHaveBeenCalled();
    await act(async () => fireEvent.click(within(dialog).getByRole("button", { name: "Accept 4 classes" })));
    expect(onAccepted).toHaveBeenCalledTimes(4);
  });

  it("confirms bulk rejection and discloses grounding on demand", async () => {
    const { region } = mount(2);
    const grounding = within(region).getByRole("button", { name: "Grounding" });
    expect(grounding.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(grounding);
    expect(grounding.getAttribute("aria-expanded")).toBe("true");
    expect(within(region).getByText("Based on: label, definition, parents, and 2 existing siblings")).toBeDefined();
    fireEvent.click(within(region).getByRole("button", { name: "Reject all" }));
    const dialog = screen.getByRole("dialog", { name: "Reject all suggestions" });
    expect(within(region).getByText(/2 pending, 0 accepted, 0 rejected/)).toBeDefined();
    fireEvent.click(within(dialog).getByRole("button", { name: "Reject 2 suggestions" }));
    await waitFor(() => expect(within(region).getByText(/0 pending, 0 accepted, 2 rejected/)).toBeDefined());
  });
  it("names a single pending suggestion in the singular when rejecting all", () => {
    const { region } = mount(1);
    fireEvent.click(within(region).getByRole("button", { name: "Reject all" }));
    const dialog = screen.getByRole("dialog", { name: "Reject all suggestions" });
    expect(within(dialog).getByRole("button", { name: "Reject 1 suggestion" })).toBeDefined();
  });

  it("shows a refused request without an empty progress count", () => {
    const refusal = "Today's AI request limit for your role has been reached.";
    const review = {
      items: [], hasBatch: false, isLoading: false, isAcceptingAll: false, eligibleCount: 0,
      error: refusal, requestError: refusal, acceptingIndices: new Set<number>(),
    } as unknown as ReturnType<typeof useSuggestions>;
    render(
      <ToastProvider>
        <SuggestionBatchReview title={title} review={review} onRequest={vi.fn()} siblingCount={0} />
      </ToastProvider>,
    );
    const region = screen.getByRole("region", { name: title });
    expect(within(region).getByText(refusal)).toBeDefined();
    expect(within(region).queryByText(/0 pending/)).toBeNull();
  });
});
