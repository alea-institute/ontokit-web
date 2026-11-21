import { fireEvent, render, screen } from "@testing-library/react";
import { TooltipProvider } from "@radix-ui/react-tooltip";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OriginBadge } from "@/components/changes/OriginBadge";

describe("OriginBadge", () => {
  afterEach(() => vi.unstubAllGlobals());

  it.each([
    ["human", "Human"],
    ["ai", "AI"],
    ["ai_edited", "AI edited"],
    ["system", "System"],
    ["future_origin", "Human"],
  ])("renders a readable label for %s", (origin, label) => {
    render(<TooltipProvider><OriginBadge origin={origin} /></TooltipProvider>);
    expect(screen.getByText(label)).toBeDefined();
  });

  it.each([
    ["human", "Human", "Saved by a person; not matched to an AI suggestion."],
    ["ai", "AI", "Created from an AI suggestion accepted with its original label and definition."],
    ["ai_edited", "AI edited", "Created from an AI suggestion with edits to the suggested label or definition."],
    ["system", "System", "Recorded by an import, sync, normalization, or history backfill."],
  ])("explains %s origin", async (origin, label, description) => {
    vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
    render(<TooltipProvider><OriginBadge origin={origin} /></TooltipProvider>);
    fireEvent.focus(screen.getByText(label));
    expect((await screen.findByRole("tooltip")).textContent).toBe(description);
  });
});
