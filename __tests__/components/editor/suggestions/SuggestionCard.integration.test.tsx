import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { SuggestionCard } from "@/components/editor/suggestions/SuggestionCard";
import { useSuggestionStore, storeKey } from "@/lib/stores/suggestionStore";
import { useSuggestions } from "@/lib/hooks/useSuggestions";
import { distinctDecisionsApi } from "@/lib/api/duplicateCheck";
import { jsonResponse } from "@/__tests__/fixtures/llm-hook-harness";

const scope = { projectId: "card-integration", branch: "main" };
const iri = "https://example.test/Parent";
const key = storeKey(scope, iri, "children");
function Card({ busy = false }: { busy?: boolean }) {
  const review = useSuggestions({ ...scope, entityIri: iri, suggestionType: "children", canUseLLM: false });
  const item = review.items[0];
  return <SuggestionCard item={item} busy={busy} onAccept={() => { void review.accept(0); }} onReject={() => review.reject(0)} onEdit={(value) => { review.edit(0, value); void review.accept(0); }} onMarkDistinct={async (candidate, reason) => {
    await distinctDecisionsApi.mark(scope.projectId, { proposed_iri: item.suggestion.iri, label: item.suggestion.label, candidate_iri: candidate.iri, candidate_branch: candidate.branch, entity_type: "class", reason }, "token");
    useSuggestionStore.getState().removeDuplicateCandidate(scope, iri, "children", 0, candidate);
  }} />;
}
beforeEach(() => {
  useSuggestionStore.getState().setSuggestions(scope, iri, "children", [{ iri: "https://example.test/Child", label: "Suggested child", suggestion_type: "children", confidence: 0.4, provenance: "llm-proposed", validation_errors: [], duplicate_verdict: "block", duplicate_candidates: [{ iri: "https://example.test/Existing", label: "Existing child", branch: "main", score: 0.99 }] }]);
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); useSuggestionStore.getState().clearAllSuggestions(); });
function openDecision() {
  fireEvent.click(screen.getByRole("button", { name: "Mark Existing child as a distinct entity" }));
  fireEvent.change(screen.getByRole("textbox", { name: "Why are these different?" }), { target: { value: "  Different concepts  " } });
}
describe("suggestion card real review chains", () => {
  it("retries a failed distinct decision through the API then unblocks acceptance in the store", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(jsonResponse({ detail: "Review service unavailable" }, 503)).mockResolvedValueOnce(jsonResponse({ id: "decision-1" }));
    vi.stubGlobal("fetch", fetcher);
    render(<Card />); openDecision();
    fireEvent.click(screen.getByRole("button", { name: "Mark as distinct" }));
    expect((await screen.findByRole("alert")).textContent).toContain("Review service unavailable");
    expect(useSuggestionStore.getState().suggestions[key][0].suggestion.duplicate_verdict).toBe("block");
    fireEvent.click(screen.getByRole("button", { name: "Mark as distinct" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(JSON.parse(fetcher.mock.calls[1][1].body)).toMatchObject({ reason: "Different concepts", candidate_branch: "main" });
    expect(new Headers(fetcher.mock.calls[1][1].headers).get("Authorization")).toBe("Bearer token");
    fireEvent.click(screen.getByRole("button", { name: "Accept suggestion" }));
    await waitFor(() => expect(useSuggestionStore.getState().suggestions[key][0].status).toBe("accepted"));
  });
  it("keeps an in-flight decision open on Escape and closes after success", async () => {
    let resolve!: (response: Response) => void;
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>(done => { resolve = done; })));
    render(<Card />); openDecision();
    fireEvent.click(screen.getByRole("button", { name: "Mark as distinct" }));
    await waitFor(() => expect((screen.getByRole("textbox") as HTMLTextAreaElement).disabled).toBe(true));
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(screen.getByRole("dialog")).toBeDefined();
    await act(async () => resolve(jsonResponse({ id: "done" })));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });
  it("clears discarded reason and refuses whitespace-only decisions", () => {
    const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
    render(<Card />); openDecision();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    fireEvent.click(screen.getByRole("button", { name: "Mark Existing child as a distinct entity" }));
    expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe("");
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "   " } });
    fireEvent.submit(screen.getByRole("textbox").closest("form")!);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("discards edits with Escape and accepts a changed duplicate with Enter through the store", async () => {
    render(<Card />);
    fireEvent.click(screen.getByRole("button", { name: "Edit suggestion before accepting" }));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Discarded" } });
    fireEvent.keyDown(screen.getByRole("textbox"), { key: "Escape" });
    expect(useSuggestionStore.getState().suggestions[key][0].editedValue).toBeUndefined();
    fireEvent.click(screen.getByRole("button", { name: "Edit suggestion before accepting" }));
    expect((screen.getByRole("textbox") as HTMLInputElement).value).toBe("Suggested child");
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Distinct child" } });
    fireEvent.keyDown(screen.getByRole("textbox"), { key: "Enter" });
    await waitFor(() => expect(useSuggestionStore.getState().suggestions[key][0]).toMatchObject({ status: "accepted", editedValue: "Distinct child", suggestion: { provenance: "user-edited-from-llm" } }));
  });
  it("blocks edit, reject and accept while persistence is busy", () => {
    render(<Card busy />);
    for (const name of ["Accept suggestion", "Reject suggestion", "Edit suggestion before accepting"]) {
      const button = screen.getByRole("button", { name });
      expect((button as HTMLButtonElement).disabled).toBe(true); fireEvent.click(button);
    }
    expect(useSuggestionStore.getState().suggestions[key][0].status).toBe("pending");
    expect(screen.queryByRole("textbox")).toBeNull();
  });
});
