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

  it("explains which suggestion edits count toward AI edited origin", async () => {
    vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
    render(<TooltipProvider><OriginBadge origin="ai_edited" /></TooltipProvider>);
    fireEvent.focus(screen.getByText("AI edited"));
    expect((await screen.findByRole("tooltip")).textContent).toMatch(/suggested label or definition/i);
  });
});
