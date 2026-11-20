import { render, screen } from "@testing-library/react";
import { TooltipProvider } from "@radix-ui/react-tooltip";
import { describe, expect, it } from "vitest";
import { OriginBadge } from "@/components/changes/OriginBadge";

describe("OriginBadge", () => {
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
});
