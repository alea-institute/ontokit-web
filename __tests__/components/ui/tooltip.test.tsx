import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { Tooltip } from "@/components/ui/tooltip";

// jsdom lacks the browser observer used by Radix's positioning layer.
beforeEach(() => {
  vi.stubGlobal("ResizeObserver", class {
    observe() {}
    unobserve() {}
    disconnect() {}
  });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

// Wrap in TooltipProvider as Radix requires it
function renderWithProvider(ui: React.ReactNode) {
  return render(
    <TooltipPrimitive.Provider delayDuration={0}>{ui}</TooltipPrimitive.Provider>
  );
}

describe("Tooltip", () => {
  it("renders children (trigger)", () => {
    renderWithProvider(
      <Tooltip content="Help text">
        <button>Hover me</button>
      </Tooltip>
    );
    expect(screen.getByText("Hover me")).toBeDefined();
  });

  it("does not show tooltip content initially", () => {
    renderWithProvider(
      <Tooltip content="Tooltip info">
        <button>Trigger</button>
      </Tooltip>
    );
    expect(screen.queryByText("Tooltip info")).toBeNull();
  });

  it("shows tooltip content on hover", async () => {
    const user = userEvent.setup();
    renderWithProvider(
      <Tooltip content="Visible now">
        <button>Hover target</button>
      </Tooltip>
    );
    await user.hover(screen.getByText("Hover target"));
    const tooltip = await screen.findByRole("tooltip");
    expect(tooltip.textContent).toBe("Visible now");
    expect(screen.getByRole("button").getAttribute("aria-describedby")).toBe(tooltip.id);
    await user.unhover(screen.getByRole("button"));
    await user.pointer({ target: document.body, coords: { clientX: 100, clientY: 100 } });
    await waitFor(() => expect(screen.queryByRole("tooltip")).toBeNull());
  });

  it("renders with string content", async () => {
    renderWithProvider(
      <Tooltip content="String content">
        <button>Btn</button>
      </Tooltip>
    );
    await userEvent.hover(screen.getByRole("button"));
    const tooltip = await screen.findByRole("tooltip");
    expect(within(tooltip).getByText("String content")).toBeDefined();
  });

  it("renders with JSX content", async () => {
    renderWithProvider(
      <Tooltip content={<span>JSX content</span>}>
        <button>Btn</button>
      </Tooltip>
    );
    await userEvent.hover(screen.getByRole("button"));
    const tooltip = await screen.findByRole("tooltip");
    expect(within(tooltip).getByText("JSX content")).toBeDefined();
  });

  it("places the opened content on the requested side", async () => {
    renderWithProvider(
      <Tooltip content="Bottom tip" side="bottom">
        <button>Btn</button>
      </Tooltip>
    );
    await userEvent.hover(screen.getByRole("button"));
    const tooltip = await screen.findByRole("tooltip");
    expect(within(tooltip).getByText("Bottom tip")).toBeDefined();
    expect(tooltip.getAttribute("data-side")).toBe("bottom");
  });

  it("aligns the opened content with the trigger", async () => {
    renderWithProvider(
      <Tooltip content="Start aligned" align="start">
        <button>Btn</button>
      </Tooltip>
    );
    await userEvent.hover(screen.getByRole("button"));
    const tooltip = await screen.findByRole("tooltip");
    expect(within(tooltip).getByText("Start aligned")).toBeDefined();
    expect(tooltip.getAttribute("data-align")).toBe("start");
  });

  it("renders trigger as child element (asChild)", () => {
    renderWithProvider(
      <Tooltip content="Info">
        <a href="/link">Link trigger</a>
      </Tooltip>
    );
    const link = screen.getByText("Link trigger");
    expect(link.tagName).toBe("A");
  });
  it("opens from keyboard focus and dismisses with Escape", async () => {
    renderWithProvider(<Tooltip content="Keyboard help"><button>Help</button></Tooltip>);
    await userEvent.tab();
    expect((await screen.findByRole("tooltip")).textContent).toBe("Keyboard help");
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("tooltip")).toBeNull());
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Help" }));
  });

});
