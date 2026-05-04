import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";
import { Button } from "@/components/ui/button";

describe("Button", () => {
  // ── Variants ──────────────────────────────────────────────────────
  it("renders primary variant classes by default", () => {
    render(<Button>Click</Button>);
    const btn = screen.getByRole("button", { name: "Click" });
    expect(btn.className).toContain("bg-primary-600");
  });

  it("renders secondary variant classes", () => {
    render(<Button variant="secondary">Sec</Button>);
    const btn = screen.getByRole("button", { name: "Sec" });
    expect(btn.className).toContain("bg-slate-100");
    expect(btn.className).toContain("text-slate-900");
  });

  it("renders outline variant classes", () => {
    render(<Button variant="outline">Outline</Button>);
    const btn = screen.getByRole("button", { name: "Outline" });
    expect(btn.className).toContain("border");
    expect(btn.className).toContain("bg-transparent");
  });

  it("renders ghost variant classes", () => {
    render(<Button variant="ghost">Ghost</Button>);
    const btn = screen.getByRole("button", { name: "Ghost" });
    expect(btn.className).toContain("bg-transparent");
  });

  it("renders danger variant classes", () => {
    render(<Button variant="danger">Danger</Button>);
    const btn = screen.getByRole("button", { name: "Danger" });
    expect(btn.className).toContain("bg-red-600");
    expect(btn.className).toContain("text-white");
  });

  // ── Sizes ─────────────────────────────────────────────────────────
  it("renders sm size classes", () => {
    render(<Button size="sm">Small</Button>);
    const btn = screen.getByRole("button", { name: "Small" });
    expect(btn.className).toContain("h-8");
    expect(btn.className).toContain("px-3");
  });

  it("renders md size classes by default", () => {
    render(<Button>Medium</Button>);
    const btn = screen.getByRole("button", { name: "Medium" });
    expect(btn.className).toContain("h-10");
    expect(btn.className).toContain("px-4");
  });

  it("renders lg size classes", () => {
    render(<Button size="lg">Large</Button>);
    const btn = screen.getByRole("button", { name: "Large" });
    expect(btn.className).toContain("h-12");
    expect(btn.className).toContain("px-6");
  });

  // ── cursor-pointer ────────────────────────────────────────────────
  it("always has cursor-pointer class", () => {
    render(<Button>Click</Button>);
    expect(screen.getByRole("button").className).toContain("cursor-pointer");
  });

  it("has cursor-pointer even for ghost variant", () => {
    render(<Button variant="ghost">Ghost</Button>);
    expect(screen.getByRole("button").className).toContain("cursor-pointer");
  });

  // ── Disabled ──────────────────────────────────────────────────────
  it("sets the disabled attribute", () => {
    render(<Button disabled>Disabled</Button>);
    expect(screen.getByRole("button").hasAttribute("disabled")).toBe(true);
  });

  it("applies disabled styling classes", () => {
    render(<Button disabled>Disabled</Button>);
    const btn = screen.getByRole("button");
    expect(btn.className).toContain("disabled:pointer-events-none");
    expect(btn.className).toContain("disabled:opacity-50");
  });

  it("does not call onClick when disabled", async () => {
    const handleClick = vi.fn();
    render(<Button disabled onClick={handleClick}>Disabled</Button>);
    await userEvent.click(screen.getByRole("button"));
    expect(handleClick).not.toHaveBeenCalled();
  });

  // ── className merge ───────────────────────────────────────────────
  it("merges custom className", () => {
    render(<Button className="my-custom-class">Merged</Button>);
    const btn = screen.getByRole("button");
    expect(btn.className).toContain("my-custom-class");
    // still has base classes
    expect(btn.className).toContain("inline-flex");
  });

  // ── Ref forwarding ────────────────────────────────────────────────
  it("forwards ref to the button element", () => {
    const ref = createRef<HTMLButtonElement>();
    render(<Button ref={ref}>Ref</Button>);
    expect(ref.current).toBeInstanceOf(HTMLButtonElement);
    expect(ref.current?.textContent).toBe("Ref");
  });

  // ── onClick ───────────────────────────────────────────────────────
  it("calls onClick handler when clicked", async () => {
    const handleClick = vi.fn();
    render(<Button onClick={handleClick}>Click Me</Button>);
    await userEvent.click(screen.getByRole("button"));
    expect(handleClick).toHaveBeenCalledOnce();
  });
});
