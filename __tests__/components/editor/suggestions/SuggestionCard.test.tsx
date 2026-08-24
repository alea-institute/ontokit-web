import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SuggestionCard } from "@/components/editor/suggestions/SuggestionCard";
import type { StoredSuggestion } from "@/lib/stores/suggestionStore";
import type { GeneratedSuggestion } from "@/lib/api/generation";

function makeSuggestion(overrides: Partial<GeneratedSuggestion> = {}): GeneratedSuggestion {
  return {
    iri: "http://example.org/Child1",
    suggestion_type: "children",
    label: "Child 1",
    definition: "A child class",
    confidence: 0.9,
    provenance: "llm-proposed",
    model: "gpt-4o-mini",
    prompt_template: "children",
    validation_errors: [],
    duplicate_verdict: "pass",
    duplicate_candidates: [],
    ...overrides,
  };
}

function makeItem(overrides: Partial<StoredSuggestion> = {}): StoredSuggestion {
  return {
    suggestion: makeSuggestion(),
    status: "pending",
    ...overrides,
  };
}

function renderCard(item: StoredSuggestion, props: Partial<Parameters<typeof SuggestionCard>[0]> = {}) {
  const onAccept = vi.fn();
  const onReject = vi.fn();
  const onEdit = vi.fn();
  const onMarkDistinct = vi.fn().mockResolvedValue(undefined);
  render(
    <SuggestionCard
      item={item}
      onAccept={onAccept}
      onReject={onReject}
      onEdit={onEdit}
      onMarkDistinct={onMarkDistinct}
      {...props}
    />,
  );
  return { onAccept, onReject, onEdit, onMarkDistinct };
}

describe("SuggestionCard", () => {
  // ── H-3: provenance surfaces model AND prompt_template ──
  it("surfaces both model and prompt_template in the provenance label (H-3)", () => {
    renderCard(makeItem());
    expect(
      screen.getByText("AI-suggested by gpt-4o-mini (children)"),
    ).toBeDefined();
  });

  it("appends ', edited by you' for user-edited suggestions", () => {
    renderCard(
      makeItem({
        suggestion: makeSuggestion({ provenance: "user-edited-from-llm" }),
        editedValue: "Reworded",
      }),
    );
    expect(
      screen.getByText("AI-suggested by gpt-4o-mini (children), edited by you"),
    ).toBeDefined();
  });

  // ── M-4: warn verdict is announced to screen readers ──
  it("announces the duplicate 'warn' verdict to screen readers (M-4)", () => {
    renderCard(makeItem({ suggestion: makeSuggestion({ duplicate_verdict: "warn" }) }));
    expect(screen.getAllByText("Similar entity may already exist").length).toBeGreaterThan(0);
  });

  // ── L-2: validation errors are surfaced ──
  it("renders validation_errors so malformed suggestions don't read as clean (L-2)", () => {
    renderCard(
      makeItem({
        suggestion: makeSuggestion({
          validation_errors: [
            { field: "label", code: "too_long", message: "Label exceeds 60 characters" },
          ],
        }),
      }),
    );
    expect(screen.getByText(/Label exceeds 60 characters/)).toBeDefined();
  });

  it("disables both plain and edit acceptance when validation_errors are present", () => {
    renderCard(
      makeItem({
        suggestion: makeSuggestion({
          validation_errors: [
            { field: "iri", code: "invalid", message: "IRI is not valid" },
          ],
        }),
      }),
    );

    expect((screen.getByRole("button", { name: "Accept suggestion" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Edit suggestion before accepting" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Reject suggestion" }) as HTMLButtonElement).disabled).toBe(false);
  });

  // ── L-3: confidence badge has an accessible name ──
  it("gives the confidence badge an accessible name (L-3)", () => {
    renderCard(makeItem({ suggestion: makeSuggestion({ confidence: 0.82 }) }));
    expect(screen.getByLabelText("confidence 82%")).toBeDefined();
  });

  // ── M-5: blocked duplicates cannot be committed via the edit flow ──
  it("does NOT commit an unchanged blocked duplicate via the edit flow (M-5)", async () => {
    const user = userEvent.setup();
    const item = makeItem({
      suggestion: makeSuggestion({ duplicate_verdict: "block" }),
    });
    const { onEdit } = renderCard(item, { disabled: true });

    await user.click(screen.getByLabelText("Edit suggestion before accepting"));
    // Commit without changing the text — must be refused.
    await user.click(screen.getByRole("button", { name: "Accept" }));

    expect(onEdit).not.toHaveBeenCalled();
  });

  it("allows committing a blocked duplicate once the text is changed (M-5)", async () => {
    const user = userEvent.setup();
    const item = makeItem({
      suggestion: makeSuggestion({ duplicate_verdict: "block", label: "Child 1" }),
    });
    const { onEdit } = renderCard(item, { disabled: true });

    await user.click(screen.getByLabelText("Edit suggestion before accepting"));
    const input = screen.getByDisplayValue("Child 1");
    await user.clear(input);
    await user.type(input, "Child One Renamed");
    await user.click(screen.getByRole("button", { name: "Accept" }));

    expect(onEdit).toHaveBeenCalledWith("Child One Renamed");
  });

  it("records a distinct decision only through the explicit Not the same action", async () => {
    const user = userEvent.setup();
    const candidate = {
      iri: "http://example.org/ExistingChild",
      label: "Existing Child",
      score: 0.98,
    };
    const { onMarkDistinct, onReject } = renderCard(
      makeItem({
        suggestion: makeSuggestion({
          duplicate_verdict: "block",
          duplicate_candidates: [candidate],
        }),
      }),
    );

    await user.click(screen.getByRole("button", { name: "Mark Existing Child as a distinct entity" }));
    expect(screen.getByRole("dialog")).toBeDefined();
    expect(screen.getByText(/Rejecting a suggestion does not create this decision/)).toBeDefined();

    const reason = screen.getByRole("textbox", { name: "Why are these different?" });
    await user.type(reason, "The proposed class describes a narrower legal concept.");
    await user.click(screen.getByRole("button", { name: "Mark as distinct" }));

    expect(onMarkDistinct).toHaveBeenCalledWith(
      candidate,
      "The proposed class describes a narrower legal concept.",
    );
    expect(onReject).not.toHaveBeenCalled();
  });

  it("does not expose the distinct action without permission", () => {
    renderCard(
      makeItem({
        suggestion: makeSuggestion({
          duplicate_verdict: "warn",
          duplicate_candidates: [{
            iri: "http://example.org/ExistingChild",
            label: "Existing Child",
            score: 0.9,
          }],
        }),
      }),
      { onMarkDistinct: undefined },
    );

    expect(screen.queryByRole("button", { name: /distinct entity/i })).toBeNull();
  });
});
