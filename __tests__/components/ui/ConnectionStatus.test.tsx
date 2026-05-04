import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ConnectionStatus } from "@/components/ui/ConnectionStatus";
import type { ConnectionState } from "@/components/ui/ConnectionStatus";

// Mock the WebSocketIcon since it's a custom SVG component
vi.mock("@/components/ui/icons/WebSocketIcon", () => ({
  WebSocketIcon: ({ className }: { className?: string }) => (
    <svg data-testid="ws-icon" className={className} />
  ),
}));

describe("ConnectionStatus", () => {
  it("renders connected state with correct title", () => {
    render(<ConnectionStatus state="connected" />);
    expect(screen.getByTitle("Connected")).toBeDefined();
  });

  it("renders connecting state with correct title", () => {
    render(<ConnectionStatus state="connecting" />);
    expect(screen.getByTitle("Connecting")).toBeDefined();
  });

  it("renders disconnected state with correct title", () => {
    render(<ConnectionStatus state="disconnected" />);
    expect(screen.getByTitle("Disconnected")).toBeDefined();
  });

  it("renders disabled state with correct title", () => {
    render(<ConnectionStatus state="disabled" />);
    expect(screen.getByTitle("Not Available")).toBeDefined();
  });

  it("shows label when showLabel is true", () => {
    render(<ConnectionStatus state="connected" showLabel />);
    expect(screen.getByText("Connected")).toBeDefined();
  });

  it("does not show label when showLabel is false (default)", () => {
    render(<ConnectionStatus state="connected" />);
    expect(screen.queryByText("Connected")).toBeNull();
  });

  it("includes purpose in title when provided", () => {
    const { container } = render(<ConnectionStatus state="connected" purpose="Collaboration" />);
    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper.getAttribute("title")).toBe("Connected\nPurpose: Collaboration");
  });

  it("includes endpoint in title when provided", () => {
    const { container } = render(<ConnectionStatus state="connected" endpoint="/ws/collab" />);
    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper.getAttribute("title")).toBe("Connected\nEndpoint: /ws/collab");
  });

  it("includes both purpose and endpoint in title", () => {
    const { container } = render(
      <ConnectionStatus
        state="disconnected"
        purpose="Editing"
        endpoint="/ws/edit"
      />
    );
    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper.getAttribute("title")).toBe(
      "Disconnected\nPurpose: Editing\nEndpoint: /ws/edit"
    );
  });

  it("applies custom className", () => {
    const { container } = render(
      <ConnectionStatus state="connected" className="my-custom" />
    );
    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper.className).toContain("my-custom");
  });

  it("renders connecting state with Loader2 icon (not WebSocketIcon)", () => {
    render(<ConnectionStatus state="connecting" />);
    // Connecting state uses Loader2, not WebSocketIcon
    expect(screen.queryByTestId("ws-icon")).toBeNull();
  });

  it("renders connected state with WebSocketIcon", () => {
    render(<ConnectionStatus state="connected" />);
    const icon = screen.getByTestId("ws-icon");
    expect(icon).toBeDefined();
  });

  it.each<ConnectionState>(["connected", "connecting", "disconnected", "disabled"])(
    "renders %s state without errors",
    (state) => {
      const { container } = render(<ConnectionStatus state={state} />);
      expect(container.firstElementChild).toBeDefined();
    }
  );
});
