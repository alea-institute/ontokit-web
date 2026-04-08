import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { ProvenanceBadge } from "@/components/suggestions/ProvenanceBadge";

describe("ProvenanceBadge", () => {
  it("renders Sparkles icon with text 'LLM proposed' when provenance is llm-proposed", () => {
    render(<ProvenanceBadge provenance="llm-proposed" confidence={null} />);
    expect(screen.getByText("LLM proposed")).toBeTruthy();
  });

  it("renders Pencil icon with text 'Edited' when provenance is user-edited-from-llm", () => {
    render(<ProvenanceBadge provenance="user-edited-from-llm" confidence={null} />);
    expect(screen.getByText("Edited")).toBeTruthy();
  });

  it("renders User icon with text 'Human' when provenance is user-written", () => {
    render(<ProvenanceBadge provenance="user-written" confidence={null} />);
    expect(screen.getByText("Human")).toBeTruthy();
  });

  it("renders confidence as '87%' with green color class when confidence is 0.87", () => {
    const { container } = render(
      <ProvenanceBadge provenance="llm-proposed" confidence={0.87} />,
    );
    expect(screen.getByText("87%")).toBeTruthy();
    const confSpan = container.querySelector(".text-green-600");
    expect(confSpan).toBeTruthy();
  });

  it("renders confidence as '65%' with amber color class when confidence is 0.65", () => {
    const { container } = render(
      <ProvenanceBadge provenance="llm-proposed" confidence={0.65} />,
    );
    expect(screen.getByText("65%")).toBeTruthy();
    const confSpan = container.querySelector(".text-amber-600");
    expect(confSpan).toBeTruthy();
  });

  it("renders confidence as '45%' with red color class when confidence is 0.45", () => {
    const { container } = render(
      <ProvenanceBadge provenance="llm-proposed" confidence={0.45} />,
    );
    expect(screen.getByText("45%")).toBeTruthy();
    const confSpan = container.querySelector(".text-red-600");
    expect(confSpan).toBeTruthy();
  });

  it("renders dash '---' when confidence is null", () => {
    render(<ProvenanceBadge provenance="llm-proposed" confidence={null} />);
    expect(screen.getByText("---")).toBeTruthy();
  });

  it("aria-label contains both provenance text and confidence percentage", () => {
    render(<ProvenanceBadge provenance="llm-proposed" confidence={0.87} />);
    const badge = screen.getByLabelText(/LLM proposed.*87%/i);
    expect(badge).toBeTruthy();
  });
});
