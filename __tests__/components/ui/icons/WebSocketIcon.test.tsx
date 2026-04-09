import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { createRef } from "react";
import { WebSocketIcon } from "@/components/ui/icons/WebSocketIcon";

describe("WebSocketIcon", () => {
  it("renders an SVG element", () => {
    const { container } = render(<WebSocketIcon />);
    const svg = container.querySelector("svg");
    expect(svg).toBeTruthy();
  });

  it("uses default size of 24", () => {
    const { container } = render(<WebSocketIcon />);
    const svg = container.querySelector("svg")!;
    expect(svg.getAttribute("width")).toBe("24");
    expect(svg.getAttribute("height")).toBe("24");
  });

  it("accepts a custom size prop", () => {
    const { container } = render(<WebSocketIcon size={32} />);
    const svg = container.querySelector("svg")!;
    expect(svg.getAttribute("width")).toBe("32");
    expect(svg.getAttribute("height")).toBe("32");
  });

  it("applies custom className", () => {
    const { container } = render(<WebSocketIcon className="text-red-500" />);
    const svg = container.querySelector("svg")!;
    expect(svg.className.baseVal).toContain("text-red-500");
  });

  it("forwards ref to the SVG element", () => {
    const ref = createRef<SVGSVGElement>();
    render(<WebSocketIcon ref={ref} />);
    expect(ref.current).toBeInstanceOf(SVGSVGElement);
  });

  it("spreads additional SVG props", () => {
    const { container } = render(
      <WebSocketIcon data-testid="ws-icon" aria-label="WebSocket" />,
    );
    const svg = container.querySelector("svg")!;
    expect(svg.getAttribute("data-testid")).toBe("ws-icon");
    expect(svg.getAttribute("aria-label")).toBe("WebSocket");
  });

  it("has displayName set", () => {
    expect(WebSocketIcon.displayName).toBe("WebSocketIcon");
  });
});
