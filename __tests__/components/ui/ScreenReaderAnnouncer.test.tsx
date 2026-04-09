import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  ScreenReaderAnnouncerProvider,
  useAnnounce,
} from "@/components/ui/ScreenReaderAnnouncer";

// Helper component that uses the announce hook
function AnnounceButton({
  message,
  priority,
}: {
  message: string;
  priority?: "polite" | "assertive";
}) {
  const { announce } = useAnnounce();
  return (
    <button onClick={() => announce(message, priority)}>
      Announce
    </button>
  );
}

describe("ScreenReaderAnnouncerProvider", () => {
  it("renders children", () => {
    render(
      <ScreenReaderAnnouncerProvider>
        <p>Child content</p>
      </ScreenReaderAnnouncerProvider>,
    );
    expect(screen.getByText("Child content")).toBeDefined();
  });

  it("renders polite and assertive live regions", () => {
    render(
      <ScreenReaderAnnouncerProvider>
        <div />
      </ScreenReaderAnnouncerProvider>,
    );
    expect(screen.getByRole("status")).toBeDefined();
    expect(screen.getByRole("alert")).toBeDefined();
  });

  it("announces a polite message via the live region", async () => {
    const user = userEvent.setup();
    render(
      <ScreenReaderAnnouncerProvider>
        <AnnounceButton message="Hello world" />
      </ScreenReaderAnnouncerProvider>,
    );

    await user.click(screen.getByRole("button", { name: "Announce" }));

    // requestAnimationFrame sets the message
    await vi.waitFor(() => {
      expect(screen.getByRole("status").textContent).toBe("Hello world");
    });
  });

  it("announces an assertive message via the alert region", async () => {
    const user = userEvent.setup();
    render(
      <ScreenReaderAnnouncerProvider>
        <AnnounceButton message="Urgent!" priority="assertive" />
      </ScreenReaderAnnouncerProvider>,
    );

    await user.click(screen.getByRole("button", { name: "Announce" }));

    await vi.waitFor(() => {
      expect(screen.getByRole("alert").textContent).toBe("Urgent!");
    });
  });
});

describe("useAnnounce", () => {
  it("returns a noop announce function outside the provider", () => {
    function TestConsumer() {
      const { announce } = useAnnounce();
      return <button onClick={() => announce("test")}>Go</button>;
    }
    // Should not throw when used outside provider
    render(<TestConsumer />);
    const button = screen.getByRole("button");
    expect(button).toBeDefined();
    // Click the button to exercise the noop announce path
    fireEvent.click(button);
  });
});
