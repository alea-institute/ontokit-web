import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SuggestionScopeToggle, type SuggestionScope } from "@/components/editor/suggestions/SuggestionScopeToggle";
import { SuggestionGroupSection } from "@/components/editor/suggestions/SuggestionGroupSection";
import { SuggestionCard } from "@/components/editor/suggestions/SuggestionCard";
import { PendingSuggestionBadge } from "@/components/editor/PendingSuggestionBadge";
import { useSuggestions } from "@/lib/hooks/useSuggestions";
import { useSuggestionStore, storeKey } from "@/lib/stores/suggestionStore";
import type { GeneratedSuggestion } from "@/lib/api/generation";

const scope = { projectId: "controls", branch: "main" };
const iri = "https://example.test/Parent";
function seed() {
  const suggestion: GeneratedSuggestion = { iri: "https://example.test/Child", label: "Proposed child", suggestion_type: "children", provenance: "llm-proposed", validation_errors: [], duplicate_verdict: "pass", duplicate_candidates: [] };
  useSuggestionStore.getState().setSuggestions(scope, iri, "children", [suggestion]);
}
function Review() {
  const review = useSuggestions({ ...scope, entityIri: iri, suggestionType: "children", canUseLLM: false });
  const pending = review.items.filter((item) => item.status === "pending").length;
  const [focused, setFocused] = useState<string | null>(null);
  return <>
    <PendingSuggestionBadge count={pending} onClick={() => setFocused(useSuggestionStore.getState().getFirstPendingRef())} />
    <output aria-label="Focused suggestion">{focused ?? "none"}</output>
    <SuggestionGroupSection entityLabel="Parent" suggestionCount={pending}>
      {review.items.map((item, index) => <SuggestionCard key={item.suggestion.iri} item={item} onAccept={() => { void review.accept(index); }} onReject={() => review.reject(index)} onEdit={(value) => review.edit(index, value)} />)}
    </SuggestionGroupSection>
  </>;
}
beforeEach(() => useSuggestionStore.getState().clearAllSuggestions());
afterEach(() => { cleanup(); useSuggestionStore.getState().clearAllSuggestions(); });

describe("SuggestionGroupSection", () => {
  it("opens real cards, accepts through the hook/store and updates the group count", async () => {
    seed(); render(<Review />);
    expect(screen.queryByText("Proposed child")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Parent\s*\(1 suggestion\)/ }));
    expect(screen.getByText("Proposed child")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Accept suggestion" }));
    await waitFor(() => expect(screen.getByRole("button", { name: /Parent\s*\(0 suggestions\)/ })).toBeTruthy());
    expect(useSuggestionStore.getState().suggestions[storeKey(scope, iri, "children")][0].status).toBe("accepted");
  });

  it("toggles an initially open empty group and exposes its expanded state", () => {
    render(<SuggestionGroupSection entityLabel="Empty" suggestionCount={0} defaultOpen><p>No suggestions</p></SuggestionGroupSection>);
    const toggle = screen.getByRole("button", { name: /Empty\s*\(0 suggestions\)/ });
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByText("No suggestions")).toBeNull();
    fireEvent.click(toggle);
    expect(screen.getByText("No suggestions")).toBeTruthy();
  });

  it("reflects updated labels/counts without resetting the open state", () => {
    const view = render(<SuggestionGroupSection entityLabel="Before" suggestionCount={1}><p>Content</p></SuggestionGroupSection>);
    fireEvent.click(screen.getByRole("button"));
    view.rerender(<SuggestionGroupSection entityLabel="After" suggestionCount={2}><p>Content</p></SuggestionGroupSection>);
    expect(screen.getByRole("button", { name: /After\s*\(2 suggestions\)/ }).getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByText("Content")).toBeTruthy();
  });
});

describe("PendingSuggestionBadge", () => {
  it("navigates to the first real pending store entry and updates after rejection", () => {
    seed(); render(<Review />);
    fireEvent.click(screen.getByRole("status", { name: /pending suggestion/ }));
    expect(screen.getByLabelText("Focused suggestion").textContent).toBe(storeKey(scope, iri, "children"));
    fireEvent.click(screen.getByRole("button", { name: /Parent\s*\(1 suggestion\)/ }));
    fireEvent.click(screen.getByRole("button", { name: "Reject suggestion" }));
    expect(screen.getByRole("status", { name: /pending suggestion/ }).textContent).toBe("0");
    fireEvent.click(screen.getByRole("status", { name: /pending suggestion/ }));
    expect(screen.getByLabelText("Focused suggestion").textContent).toBe("none");
  });
  it.each([0, 1, 2])("announces %s pending suggestions with correct plurality without a click handler", (count) => {
    render(<PendingSuggestionBadge count={count} />);
    const badge = screen.getByRole("status", { name: /pending suggestion/ });
    expect(badge.getAttribute("aria-live")).toBe("polite");
    expect(badge.getAttribute("title")).toBe(`${count} pending suggestion${count === 1 ? "" : "s"} — click to scroll to first`);
    fireEvent.click(badge);
    expect(badge.textContent).toBe(String(count));
  });
});

describe("SuggestionScopeToggle", () => {
  function ScopeForm() {
    const [scope, setScope] = useState<SuggestionScope>("this-class");
    return <form onSubmit={(event) => event.preventDefault()}><SuggestionScopeToggle value={scope} onChange={setScope} /><output>{scope}</output></form>;
  }
  it("updates a controlled parent across every scope while retaining exactly one checked radio", () => {
    render(<ScopeForm />);
    for (const [name, value] of [["Siblings", "siblings"], ["Descendants", "descendants"], ["This class", "this-class"]]) {
      fireEvent.click(screen.getByRole("radio", { name }));
      expect(screen.getByText(value)).toBeTruthy();
      expect(screen.getAllByRole("radio").filter((radio) => radio.getAttribute("aria-checked") === "true")).toHaveLength(1);
      expect(screen.getByRole("radio", { name }).getAttribute("type")).toBe("button");
    }
  });
  it("supports keyboard activation through native buttons", async () => {
    render(<ScopeForm />);
    const user = userEvent.setup();
    await user.tab(); await user.tab(); await user.keyboard(" ");
    expect(screen.getByText("siblings")).toBeTruthy();
    expect(screen.getByRole("radiogroup").getAttribute("aria-label")).toBe("Suggestion scope");
  });
  it("keeps the current scope when its active option is selected again", () => {
    render(<ScopeForm />);
    fireEvent.click(screen.getByRole("radio", { name: "This class" }));
    expect(screen.getByText("this-class")).toBeTruthy();
    expect(screen.getByRole("radio", { name: "This class" }).getAttribute("aria-checked")).toBe("true");
  });
});
