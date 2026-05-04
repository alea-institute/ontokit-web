import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next/link", () => ({
  __esModule: true,
  default: ({
    children,
    ...props
  }: {
    children: React.ReactNode;
    [key: string]: unknown;
  }) => <a {...props}>{children}</a>,
}));

const mockUsePathname = vi.fn();
vi.mock("next/navigation", () => ({
  usePathname: () => mockUsePathname(),
}));

vi.mock("@/lib/utils", () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(" "),
}));

import { GuideSidebar } from "@/components/docs/GuideSidebar";

describe("GuideSidebar", () => {
  it("renders the heading", () => {
    mockUsePathname.mockReturnValue("/docs/guide/introduction");
    render(<GuideSidebar />);
    expect(screen.getByText("Ontology Guide")).toBeDefined();
  });

  it("renders all guide chapters", () => {
    mockUsePathname.mockReturnValue("/docs");
    render(<GuideSidebar />);
    expect(screen.getByText("Introduction")).toBeDefined();
    expect(screen.getByText("Types")).toBeDefined();
    expect(screen.getByText("Formats")).toBeDefined();
    expect(screen.getByText("Syntax")).toBeDefined();
    expect(screen.getByText("Vocabularies")).toBeDefined();
  });

  it("renders numbered badges for each chapter", () => {
    mockUsePathname.mockReturnValue("/docs");
    render(<GuideSidebar />);
    expect(screen.getByText("1")).toBeDefined();
    expect(screen.getByText("2")).toBeDefined();
    expect(screen.getByText("3")).toBeDefined();
    expect(screen.getByText("4")).toBeDefined();
    expect(screen.getByText("5")).toBeDefined();
  });

  it("marks the active chapter with aria-current=page", () => {
    mockUsePathname.mockReturnValue("/docs/guide/introduction");
    render(<GuideSidebar />);
    const activeLink = screen.getByText("Introduction").closest("a");
    expect(activeLink?.getAttribute("aria-current")).toBe("page");
  });

  it("does not mark inactive chapters with aria-current", () => {
    mockUsePathname.mockReturnValue("/docs/guide/introduction");
    render(<GuideSidebar />);
    const inactiveLink = screen.getByText("Types").closest("a");
    expect(inactiveLink?.getAttribute("aria-current")).toBeNull();
  });

  it("links to correct href for each chapter", () => {
    mockUsePathname.mockReturnValue("/docs");
    render(<GuideSidebar />);
    const introLink = screen.getByText("Introduction").closest("a");
    expect(introLink?.getAttribute("href")).toBe("/docs/guide/introduction");
    const typesLink = screen.getByText("Types").closest("a");
    expect(typesLink?.getAttribute("href")).toBe("/docs/guide/types");
  });
});
